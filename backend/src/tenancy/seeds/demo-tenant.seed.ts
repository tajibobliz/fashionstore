import * as bcrypt from 'bcrypt';
import { DataSource, EntityManager } from 'typeorm';
import { Empresa } from '../entities/empresa.entity';
import { Plan } from '../entities/plan.entity';
import { Suscripcion } from '../entities/suscripcion.entity';
import { Usuario } from '../../users/entities/user.entity';
import { Rol } from '../../users/entities/rol.entity';
import { UsuarioSucursal } from '../../users/entities/usuario-sucursal.entity';
import { Ciudad } from '../../branches/entities/ciudad.entity';
import { Sucursal } from '../../branches/entities/sucursal.entity';
import { Almacen } from '../../warehouses/entities/almacen.entity';
import { Caja } from '../../pos/entities/caja.entity';
import { Categoria } from '../../catalog/entities/categoria.entity';
import { Talla } from '../../catalog/entities/talla.entity';
import { Color } from '../../catalog/entities/color.entity';
import { Producto } from '../../catalog/entities/producto.entity';
import { VarianteProducto } from '../../catalog/entities/variante-producto.entity';
import { Inventario } from '../../inventory/entities/inventario.entity';
import { Venta } from '../../sales/entities/venta.entity';
import { DetalleVenta } from '../../sales/entities/detalle-venta.entity';
import { Pago } from '../../payments/entities/pago.entity';

/**
 * Empresa B de demostración: "Urban Step" (calzado y ropa deportiva), plan BÁSICO.
 * Sirve para demostrar el aislamiento entre empresas (requisito 9.3: "como mínimo,
 * dos empresas de prueba independientes"). Es idempotente: si ya existe, no hace nada.
 *
 * A propósito repite nombres que también usa la Empresa A (categoría "Accesorios",
 * tallas "38", comprobante "V-0001") para mostrar que los UNIQUE ahora son por empresa.
 */
export const DEMO_SLUG = 'urban-step';

export interface DemoSeedResult {
  creada: boolean;
  idEmpresa: number;
  usuarios: Array<{ rol: string; email: string }>;
}

export async function seedDemoTenant(
  dataSource: DataSource,
  password: string,
): Promise<DemoSeedResult> {
  return dataSource.transaction(async (m) => {
    const existente = await m.findOne(Empresa, { where: { slug: DEMO_SLUG } });
    if (existente) {
      // Corrige demos creadas con la versión anterior del seed: el almacén principal de cada
      // sucursal debe llamarse PRINCIPAL (lo buscan reservas, compras online y la sincronización).
      await m.query(
        `UPDATE almacen SET codigo = 'PRINCIPAL' WHERE id_empresa = $1 AND codigo LIKE 'US-A%'`,
        [existente.idEmpresa],
      );
      return {
        creada: false,
        idEmpresa: existente.idEmpresa,
        usuarios: demoUsers(),
      };
    }

    const empresa = await m.save(
      Empresa,
      m.create(Empresa, {
        nombre: 'Urban Step',
        slug: DEMO_SLUG,
        nit: '1029384756',
      }),
    );
    const idEmpresa = empresa.idEmpresa;
    const plan = await m.findOneOrFail(Plan, { where: { codigo: 'BASICO' } });
    await m.save(
      Suscripcion,
      m.create(Suscripcion, {
        empresa,
        plan,
        estado: 'ACTIVA',
        fechaInicio: isoDate(0),
        fechaVencimiento: isoDate(30),
      }),
    );

    // --- Sucursales (el plan Básico permite 2) ---
    const ciudad =
      (await m.findOne(Ciudad, { where: { nombre: 'Santa Cruz' } })) ??
      (await m.save(Ciudad, m.create(Ciudad, { nombre: 'Santa Cruz' })));
    const sucursales: Sucursal[] = [];
    const almacenes: Almacen[] = [];
    for (const [i, s] of [
      { nombre: 'Urban Step Centro', direccion: 'Calle 24 de Septiembre #120' },
      { nombre: 'Urban Step Equipetrol', direccion: 'Av. San Martín #455' },
    ].entries()) {
      const sucursal = await m.save(
        Sucursal,
        m.create(Sucursal, {
          ...s,
          telefono: '33300000',
          estado: true,
          ciudad,
          idEmpresa,
        }),
      );
      const almacen = await m.save(
        Almacen,
        m.create(Almacen, {
          sucursal,
          codigo: 'PRINCIPAL',
          nombre: 'Almacén principal',
          estado: true,
          idEmpresa,
        }),
      );
      await m.save(
        Caja,
        m.create(Caja, {
          sucursal,
          almacenDefault: almacen,
          codigo: `US-C${i + 1}`,
          nombre: 'Caja 1',
          estado: true,
          idEmpresa,
        }),
      );
      sucursales.push(sucursal);
      almacenes.push(almacen);
    }

    // --- Usuarios ---
    const passwordHash = await bcrypt.hash(password, 10);
    const usuarios: Record<string, Usuario> = {};
    for (const u of demoUsers()) {
      const rol = await m.findOneOrFail(Rol, { where: { nombre: u.rol } });
      usuarios[u.rol] = await m.save(
        Usuario,
        m.create(Usuario, {
          nombre: u.nombre,
          apellido: 'Urban Step',
          email: u.email,
          passwordHash,
          estado: true,
          rol,
          idEmpresa,
        }),
      );
    }
    for (const rolSucursal of ['CAJERO', 'ENCARGADO_SUCURSAL']) {
      await m.save(
        UsuarioSucursal,
        m.create(UsuarioSucursal, {
          usuario: usuarios[rolSucursal],
          sucursal: sucursales[0],
          estado: true,
        }),
      );
    }

    // --- Catálogo propio ---
    const categorias = await saveAll(
      m,
      Categoria,
      ['Zapatillas', 'Botas', 'Ropa deportiva', 'Accesorios'].map((nombre) => ({
        nombre,
        descripcion: `${nombre} Urban Step`,
        idEmpresa,
      })),
    );
    const tallas = await saveAll(
      m,
      Talla,
      ['38', '39', '40', '41', 'M', 'L'].map((nombre) => ({
        nombre,
        idEmpresa,
      })),
    );
    const colores = await saveAll(
      m,
      Color,
      [
        { nombre: 'Negro', codigoHex: '#111111' },
        { nombre: 'Blanco', codigoHex: '#FFFFFF' },
        { nombre: 'Rojo', codigoHex: '#C0392B' },
      ].map((c) => ({ ...c, idEmpresa })),
    );
    const cat = (n: string) => categorias.find((c) => c.nombre === n)!;
    const talla = (n: string) => tallas.find((t) => t.nombre === n)!;

    const catalogo = [
      {
        nombre: 'Zapatilla Runner Pro',
        categoria: 'Zapatillas',
        precio: 520,
        tallas: ['38', '39', '40', '41'],
      },
      {
        nombre: 'Zapatilla Urbana Classic',
        categoria: 'Zapatillas',
        precio: 390,
        tallas: ['38', '39', '40'],
      },
      {
        nombre: 'Bota Trekking',
        categoria: 'Botas',
        precio: 680,
        tallas: ['39', '40', '41'],
      },
      {
        nombre: 'Buzo Deportivo',
        categoria: 'Ropa deportiva',
        precio: 250,
        tallas: ['M', 'L'],
      },
      {
        nombre: 'Polera Dry-Fit',
        categoria: 'Ropa deportiva',
        precio: 120,
        tallas: ['M', 'L'],
      },
      {
        nombre: 'Mochila Urbana',
        categoria: 'Accesorios',
        precio: 210,
        tallas: [] as string[],
      },
    ];
    const variantes: VarianteProducto[] = [];
    for (const [i, p] of catalogo.entries()) {
      const producto = await m.save(
        Producto,
        m.create(Producto, {
          nombre: p.nombre,
          descripcion: `${p.nombre} — Urban Step`,
          precio: p.precio,
          estado: true,
          categoria: cat(p.categoria),
          idEmpresa,
        }),
      );
      const combinaciones = (p.tallas.length ? p.tallas : [null]).flatMap((t) =>
        colores.slice(0, 2).map((c) => ({ t, c })),
      );
      for (const [j, { t, c }] of combinaciones.entries()) {
        const variante = await m.save(
          VarianteProducto,
          m.create(VarianteProducto, {
            sku: `US-${String(i + 1).padStart(2, '0')}-${j + 1}`,
            producto,
            talla: t ? talla(t) : undefined,
            color: c,
            idEmpresa,
          }),
        );
        variantes.push(variante);
        for (const [k, almacen] of almacenes.entries()) {
          await m.save(
            Inventario,
            m.create(Inventario, {
              stockDisponible: k === 0 ? 8 + j : 3,
              stockReservado: 0,
              sucursal: sucursales[k],
              variante,
              almacen,
              idEmpresa,
            }),
          );
        }
      }
    }

    // --- Ventas de ejemplo (para que los reportes de B tengan datos propios) ---
    for (const [n, cantidad] of [2, 1, 3].entries()) {
      const variante = variantes[n * 3];
      const precio = Number(
        (
          await m.findOneOrFail(Producto, {
            where: { idProducto: variante.producto.idProducto },
          })
        ).precio,
      );
      const total = precio * cantidad;
      const venta = await m.save(
        Venta,
        m.create(Venta, {
          tipoVenta: 'PRESENCIAL',
          modalidadComercial: 'MINORISTA',
          total,
          estado: 'PAGADA',
          numeroComprobante: `V-${String(n + 1).padStart(4, '0')}`,
          sucursal: sucursales[0],
          almacen: almacenes[0],
          cajero: usuarios.CAJERO,
          usuario: usuarios.CLIENTE,
          idEmpresa,
          detalles: [
            m.create(DetalleVenta, {
              cantidad,
              precioUnitario: precio,
              subtotal: total,
              variante,
            }),
          ],
        }),
      );
      await m.save(
        Pago,
        m.create(Pago, {
          metodo: 'EFECTIVO',
          monto: total,
          estado: 'APROBADO',
          venta,
          idEmpresa,
        }),
      );
    }

    return { creada: true, idEmpresa, usuarios: demoUsers() };
  });
}

/** Usuario SUPER_ADMIN de la plataforma (sin empresa). Idempotente. */
export async function seedPlatformAdmin(
  dataSource: DataSource,
  email: string,
  password: string,
) {
  const repo = dataSource.getRepository(Usuario);
  const existe = await repo
    .createQueryBuilder('u')
    .where('u.email = :email AND u.id_empresa IS NULL', { email })
    .getOne();
  if (existe) return false;
  const rol = await dataSource
    .getRepository(Rol)
    .findOneOrFail({ where: { nombre: 'SUPER_ADMIN' } });
  await repo.save(
    repo.create({
      nombre: 'Administrador',
      apellido: 'Plataforma',
      email,
      passwordHash: await bcrypt.hash(password, 10),
      estado: true,
      rol,
      idEmpresa: null,
    }),
  );
  return true;
}

function demoUsers() {
  return [
    { rol: 'ADMIN', nombre: 'Admin', email: 'admin@urbanstep.demo' },
    {
      rol: 'ENCARGADO',
      nombre: 'Encargado',
      email: 'encargado@urbanstep.demo',
    },
    {
      rol: 'ENCARGADO_SUCURSAL',
      nombre: 'Encargado Centro',
      email: 'encargado.centro@urbanstep.demo',
    },
    { rol: 'CAJERO', nombre: 'Cajero', email: 'cajero@urbanstep.demo' },
    { rol: 'CLIENTE', nombre: 'Cliente', email: 'cliente@urbanstep.demo' },
  ];
}

async function saveAll<T extends object>(
  m: EntityManager,
  entity: new () => T,
  rows: Partial<T>[],
): Promise<T[]> {
  return m.save(
    entity,
    rows.map((r) => m.create(entity, r as any)),
  ) as Promise<T[]>;
}

function isoDate(daysFromToday: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}
