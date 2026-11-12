/**
 * Reportes flexibles ("a medida") para los reportes con IA.
 *
 * Es un MENÚ CERRADO: el usuario (o el modelo de IA) solo elige claves de estas listas
 * —columnas para agrupar, métricas, filtros y orden—. Cada clave tiene su expresión SQL fija
 * escrita aquí; nunca se arma SQL con texto del usuario. Los valores de los filtros van como
 * parámetros de la consulta, y la empresa la sigue aislando RLS.
 */
import type { FormatoColumna } from '../ai/reports/report-tools';

export interface DefinicionColumna {
  etiqueta: string;
  formato: FormatoColumna;
  /** Expresión SQL de la columna (fija). */
  sql: string;
  /** Expresiones del GROUP BY (dimensiones). */
  grupo?: string[];
}

/** `__FECHA__` = la fecha de la venta en la hora de la tienda; ReportsService lo reemplaza. */
export const FECHA_TIENDA = '__FECHA__';
const SIN = (expr: string) => `COALESCE(${expr}, '—')`;

/** Unidades vendidas netas: lo vendido menos lo devuelto de ese detalle. */
export const DEVUELTO = `COALESCE((SELECT SUM(dd.cantidad) FROM detalle_devolucion dd JOIN devolucion de ON de.id_devolucion=dd.id_devolucion WHERE dd.id_detalle_venta=dv.id_detalle_venta),0)`;
const UNIDADES = `SUM(dv.cantidad-${DEVUELTO})`;
const INGRESO = `SUM(dv.precio_unitario*(dv.cantidad-${DEVUELTO}))`;

export const DIMENSIONES_VENTAS: Record<string, DefinicionColumna> = {
  producto: { etiqueta: 'Producto', formato: 'texto', sql: 'p.nombre', grupo: ['p.id_producto', 'p.nombre'] },
  categoria: { etiqueta: 'Categoría', formato: 'texto', sql: `COALESCE(cat.nombre, 'Sin categoría')` },
  talla: { etiqueta: 'Talla', formato: 'texto', sql: SIN('ta.nombre') },
  color: { etiqueta: 'Color', formato: 'texto', sql: SIN('co.nombre') },
  sku: { etiqueta: 'SKU', formato: 'texto', sql: 'vr.sku' },
  sucursal: { etiqueta: 'Sucursal', formato: 'texto', sql: 's.nombre', grupo: ['s.id_sucursal', 's.nombre'] },
  canal: { etiqueta: 'Canal', formato: 'texto', sql: `CASE v.tipo_venta WHEN 'DIGITAL' THEN 'Digital' ELSE 'Presencial' END` },
  dia: { etiqueta: 'Día', formato: 'fecha', sql: `TO_CHAR(DATE_TRUNC('day', __FECHA__), 'YYYY-MM-DD')` },
  semana: { etiqueta: 'Semana (desde)', formato: 'fecha', sql: `TO_CHAR(DATE_TRUNC('week', __FECHA__), 'YYYY-MM-DD')` },
  mes: { etiqueta: 'Mes', formato: 'texto', sql: `TO_CHAR(DATE_TRUNC('month', __FECHA__), 'YYYY-MM')` },
};

export const METRICAS_VENTAS: Record<string, DefinicionColumna> = {
  unidades: { etiqueta: 'Unidades vendidas', formato: 'numero', sql: UNIDADES },
  ingreso: { etiqueta: 'Ingreso', formato: 'moneda', sql: INGRESO },
  ventas: { etiqueta: 'N.º de ventas', formato: 'numero', sql: 'COUNT(DISTINCT v.id_venta)' },
  precioPromedio: { etiqueta: 'Precio promedio', formato: 'moneda', sql: `ROUND(${INGRESO}/NULLIF(${UNIDADES},0), 2)` },
};

export const DIMENSIONES_INVENTARIO: Record<string, DefinicionColumna> = {
  producto: { etiqueta: 'Producto', formato: 'texto', sql: 'p.nombre', grupo: ['p.id_producto', 'p.nombre'] },
  categoria: { etiqueta: 'Categoría', formato: 'texto', sql: `COALESCE(cat.nombre, 'Sin categoría')` },
  talla: { etiqueta: 'Talla', formato: 'texto', sql: SIN('ta.nombre') },
  color: { etiqueta: 'Color', formato: 'texto', sql: SIN('co.nombre') },
  sku: { etiqueta: 'SKU', formato: 'texto', sql: 'vr.sku' },
  sucursal: { etiqueta: 'Sucursal', formato: 'texto', sql: 's.nombre', grupo: ['s.id_sucursal', 's.nombre'] },
  almacen: { etiqueta: 'Almacén', formato: 'texto', sql: 'a.nombre', grupo: ['a.id_almacen', 'a.nombre'] },
};

export const METRICAS_INVENTARIO: Record<string, DefinicionColumna> = {
  stockDisponible: { etiqueta: 'Stock disponible', formato: 'numero', sql: 'SUM(i.stock_disponible)' },
  stockReservado: { etiqueta: 'Stock reservado', formato: 'numero', sql: 'SUM(i.stock_reservado)' },
  stockTotal: { etiqueta: 'Stock total', formato: 'numero', sql: 'SUM(i.stock_disponible+i.stock_reservado)' },
};

export const PERIODOS = ['dia', 'semana', 'mes'];
export const MAX_FILAS_FLEXIBLE = 1000;

/** Filtros por nombre (ya resueltos al nombre exacto del catálogo) y orden. */
export interface OpcionesFlexibles {
  agrupar: string[];
  metricas: string[];
  categorias?: string[];
  tallas?: string[];
  colores?: string[];
  /** Texto que debe contener el nombre del producto (cualquiera de la lista). */
  productos?: string[];
  ordenarPor: string;
  direccion: 'ASC' | 'DESC';
  limite: number;
}

export interface OpcionesVentasFlexibles extends OpcionesFlexibles {
  canal?: 'DIGITAL' | 'PRESENCIAL';
}

export interface OpcionesInventarioFlexible extends OpcionesFlexibles {
  idSucursal?: number;
  stockMinimo?: number;
  stockMaximo?: number;
}
