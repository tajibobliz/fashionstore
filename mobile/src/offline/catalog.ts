import { syncService } from "@/services/sync.service";
import type { CatalogoSync } from "@/services/sync.service";
import { branchesService } from "@/services/branches.service";
import { db } from "./db";
import { hayConexion } from "./network";

/** Sucursal guardada en el teléfono. */
export interface SucursalLocal {
  idSucursal: number;
  nombre: string;
  serverTime: string;
  guardadoEn: string;
}

/** Prenda del catálogo guardado, con su stock en una sucursal. */
export interface PrendaLocal {
  idProducto: number;
  nombre: string;
  categoria: string | null;
  precioFinal: number;
  variantes: { idVariante: number; sku: string; talla: string | null; color: string | null; stock: number }[];
}

/**
 * Guarda en SQLite la foto del catálogo de una sucursal (todo en una transacción:
 * si algo falla, queda el catálogo anterior completo).
 * Se usa UPSERT y no "INSERT OR REPLACE" porque REPLACE borra la fila y, por la clave
 * foránea con ON DELETE CASCADE, también borraría variantes e inventario.
 */
export async function guardarCatalogo(idEmpresa: number, data: CatalogoSync) {
  const base = await db();
  const ahora = new Date().toISOString();
  const idSucursal = data.sucursal.idSucursal;
  await base.withTransactionAsync(async () => {
    await base.runAsync(
      `INSERT INTO sucursal (id_empresa, id_sucursal, nombre, server_time, guardado_en) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (id_empresa, id_sucursal) DO UPDATE SET nombre = excluded.nombre, server_time = excluded.server_time, guardado_en = excluded.guardado_en`,
      idEmpresa, idSucursal, data.sucursal.nombre, data.serverTime, ahora,
    );
    await base.runAsync("DELETE FROM inventario_local WHERE id_empresa = ? AND id_sucursal = ?", idEmpresa, idSucursal);
    for (const p of data.productos) {
      await base.runAsync(
        `INSERT INTO producto (id_empresa, id_producto, nombre, categoria, imagen_url, precio, precio_final) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id_empresa, id_producto) DO UPDATE SET nombre = excluded.nombre, categoria = excluded.categoria,
           imagen_url = excluded.imagen_url, precio = excluded.precio, precio_final = excluded.precio_final`,
        idEmpresa, p.idProducto, p.nombre, p.categoria, p.imagenUrl, p.precio, p.precioFinal,
      );
      for (const v of p.variantes) {
        await base.runAsync(
          `INSERT INTO variante (id_empresa, id_variante, id_producto, sku, talla, color) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT (id_empresa, id_variante) DO UPDATE SET id_producto = excluded.id_producto, sku = excluded.sku,
             talla = excluded.talla, color = excluded.color`,
          idEmpresa, v.idVariante, p.idProducto, v.sku, v.talla, v.color,
        );
        await base.runAsync(
          "INSERT INTO inventario_local (id_empresa, id_sucursal, id_variante, stock) VALUES (?, ?, ?, ?)",
          idEmpresa, idSucursal, v.idVariante, Math.max(0, v.stockDisponible),
        );
      }
    }
  });
}

export async function descargarCatalogo(idEmpresa: number, idSucursal: number) {
  await guardarCatalogo(idEmpresa, await syncService.catalogo(idSucursal));
}

let preparando: Promise<void> | null = null;

/**
 * Con conexión y sesión de clienta: guarda el catálogo de todas las sucursales activas
 * para poder ver prendas y reservar sin internet. Los errores no interrumpen la app.
 */
export function prepararOffline(idEmpresa: number) {
  if (!preparando) {
    preparando = (async () => {
      if (!(await hayConexion())) return;
      const sucursales = await branchesService.getAll();
      for (const s of sucursales) await descargarCatalogo(idEmpresa, s.idSucursal);
    })()
      .catch((error) => console.warn("[offline] No se pudo guardar el catálogo:", error?.message ?? error))
      .finally(() => { preparando = null; });
  }
  return preparando;
}

export async function sucursalesGuardadas(idEmpresa: number): Promise<SucursalLocal[]> {
  const base = await db();
  return base.getAllAsync<SucursalLocal>(
    `SELECT id_sucursal AS idSucursal, nombre, server_time AS serverTime, guardado_en AS guardadoEn
     FROM sucursal WHERE id_empresa = ? ORDER BY nombre`,
    idEmpresa,
  );
}

/** Prendas con stock de una sucursal guardada (JOIN entre las tres tablas). */
export async function catalogoGuardado(idEmpresa: number, idSucursal: number): Promise<PrendaLocal[]> {
  const base = await db();
  const filas = await base.getAllAsync<{
    idProducto: number; nombre: string; categoria: string | null; precioFinal: number;
    idVariante: number; sku: string; talla: string | null; color: string | null; stock: number;
  }>(
    `SELECT p.id_producto AS idProducto, p.nombre, p.categoria, p.precio_final AS precioFinal,
            v.id_variante AS idVariante, v.sku, v.talla, v.color, i.stock
     FROM inventario_local i
     JOIN variante v ON v.id_empresa = i.id_empresa AND v.id_variante = i.id_variante
     JOIN producto p ON p.id_empresa = v.id_empresa AND p.id_producto = v.id_producto
     WHERE i.id_empresa = ? AND i.id_sucursal = ?
     ORDER BY p.nombre, v.id_variante`,
    idEmpresa, idSucursal,
  );
  const prendas = new Map<number, PrendaLocal>();
  for (const f of filas) {
    if (!prendas.has(f.idProducto)) {
      prendas.set(f.idProducto, { idProducto: f.idProducto, nombre: f.nombre, categoria: f.categoria, precioFinal: f.precioFinal, variantes: [] });
    }
    prendas.get(f.idProducto)!.variantes.push({ idVariante: f.idVariante, sku: f.sku, talla: f.talla, color: f.color, stock: f.stock });
  }
  return [...prendas.values()];
}

/** Resta en el catálogo local lo reservado sin conexión (nunca baja de 0). */
export async function descontarStockLocal(idEmpresa: number, idSucursal: number, items: { idVariante: number; cantidad: number }[]) {
  const base = await db();
  await base.withTransactionAsync(async () => {
    for (const i of items) {
      await base.runAsync(
        "UPDATE inventario_local SET stock = MAX(0, stock - ?) WHERE id_empresa = ? AND id_sucursal = ? AND id_variante = ?",
        i.cantidad, idEmpresa, idSucursal, i.idVariante,
      );
    }
  });
}
