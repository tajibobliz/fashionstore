import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import type { ReportScope } from './reports.service';

const VALIDAS = ['PAGADA', 'DEVUELTA_PARCIAL', 'DEVUELTA'];
const DEVUELTAS = `COALESCE((SELECT SUM(dd.cantidad) FROM detalle_devolucion dd WHERE dd.id_detalle_venta = dv.id_detalle_venta), 0)`;
const STOCK_CRITICO = 5;

/**
 * Indicadores clave (KPIs) del dashboard analítico — CU12, Fase 3 tarea 3.4.
 *
 * Todo se calcula en la zona horaria de la empresa (APP_TIMEZONE): "hoy" y "este mes"
 * son los de Bolivia, no los del servidor. Alcance: RLS (empresa) + `id_empresa` explícito
 * + sucursales asignadas al usuario (el encargado de sucursal solo ve las suyas).
 */
@Injectable()
export class KpisService {
  private readonly zona: string;

  constructor(private readonly db: DataSource, config: ConfigService) {
    this.zona = config.get<string>('APP_TIMEZONE') || 'America/La_Paz';
  }

  async kpis(idEmpresa: number, scope: ReportScope, idSucursal: number | undefined, dias: number) {
    const sucursales: { idSucursal: number; nombre: string }[] = await this.db.query(
      `SELECT id_sucursal AS "idSucursal", nombre FROM sucursal WHERE id_empresa = $1 AND estado = true ORDER BY nombre`,
      [idEmpresa],
    );
    const permitidas = sucursales.filter((s) => scope.branchIds === null || scope.branchIds.includes(s.idSucursal));
    if (idSucursal && !permitidas.some((s) => s.idSucursal === idSucursal))
      throw new ForbiddenException('No tienes acceso a esa sucursal.');
    // null = todas las de la empresa; arreglo = solo esas sucursales.
    const ids: number[] | null = idSucursal ? [idSucursal] : scope.branchIds === null ? null : permitidas.map((s) => s.idSucursal);

    // Parámetros con nombre: cada consulta empieza con este CTE y los lee de `par`.
    const params = [idEmpresa, VALIDAS, this.zona, ids, dias];
    const PAR = `WITH par AS (SELECT $1::int AS emp, $2::text[] AS estados, $3::text AS tz, $4::int[] AS ids, $5::int AS dias)`;
    const enAlcance = (col: string) => `(par.ids IS NULL OR ${col} = ANY(par.ids))`;
    const ventaValida = `v.id_empresa = par.emp AND v.estado = ANY(par.estados) AND ${enAlcance('v.id_sucursal')}`;
    const dia = `(v.fecha AT TIME ZONE par.tz)::date`;
    const hoy = `(now() AT TIME ZONE par.tz)::date`;
    const rango = `${dia} > ${hoy} - par.dias`;
    const consulta = (sql: string) => this.db.query(`${PAR} ${sql}`, params);

    const [ventas] = await consulta(
      `SELECT
         COALESCE(SUM(CASE WHEN ${dia} = ${hoy} THEN dv.precio_unitario * (dv.cantidad - ${DEVUELTAS}) END), 0) AS "hoyMonto",
         COUNT(DISTINCT CASE WHEN ${dia} = ${hoy} THEN v.id_venta END) AS "hoyCantidad",
         COALESCE(SUM(CASE WHEN ${dia} = ${hoy} - 1 THEN dv.precio_unitario * (dv.cantidad - ${DEVUELTAS}) END), 0) AS "ayerMonto",
         COALESCE(SUM(CASE WHEN date_trunc('month', ${dia}) = date_trunc('month', ${hoy}) THEN dv.precio_unitario * (dv.cantidad - ${DEVUELTAS}) END), 0) AS "mesMonto",
         COUNT(DISTINCT CASE WHEN date_trunc('month', ${dia}) = date_trunc('month', ${hoy}) THEN v.id_venta END) AS "mesCantidad",
         COALESCE(SUM(CASE WHEN date_trunc('month', ${dia}) = date_trunc('month', ${hoy}) THEN dv.cantidad - ${DEVUELTAS} END), 0) AS "mesUnidades",
         COALESCE(SUM(CASE WHEN date_trunc('month', ${dia}) = date_trunc('month', ${hoy}) AND v.tipo_venta = 'DIGITAL' THEN dv.precio_unitario * (dv.cantidad - ${DEVUELTAS}) END), 0) AS "mesDigital",
         COALESCE(SUM(CASE WHEN date_trunc('month', ${dia}) = date_trunc('month', ${hoy}) AND v.tipo_venta = 'PRESENCIAL' THEN dv.precio_unitario * (dv.cantidad - ${DEVUELTAS}) END), 0) AS "mesPresencial",
         -- Mes anterior hasta el mismo día del mes (comparación justa)
         COALESCE(SUM(CASE WHEN date_trunc('month', ${dia}) = date_trunc('month', ${hoy}) - interval '1 month'
                            AND extract(day FROM ${dia}) <= extract(day FROM ${hoy})
                       THEN dv.precio_unitario * (dv.cantidad - ${DEVUELTAS}) END), 0) AS "mesAnteriorMonto",
         COALESCE(SUM(CASE WHEN ${rango} THEN dv.cantidad END), 0) AS "rangoUnidadesBrutas",
         COALESCE(SUM(CASE WHEN ${rango} THEN ${DEVUELTAS} END), 0) AS "rangoUnidadesDevueltas"
       FROM par, venta v JOIN detalle_venta dv ON dv.id_venta = v.id_venta
       WHERE ${ventaValida}`,
    );

    const [cambios] = await consulta(
      `SELECT COALESCE(SUM(dc.cantidad), 0) AS unidades, COUNT(DISTINCT c.id_cambio) AS cambios
         FROM par, cambio c JOIN detalle_cambio dc ON dc.id_cambio = c.id_cambio JOIN venta v ON v.id_venta = c.id_venta
        WHERE c.id_empresa = par.emp AND ${enAlcance('v.id_sucursal')} AND (c.fecha AT TIME ZONE par.tz)::date > ${hoy} - par.dias`,
    );

    const topCambiadas = await consulta(
      `SELECT p.id_producto AS "idProducto", p.nombre AS producto, SUM(dc.cantidad)::int AS unidades, COUNT(DISTINCT c.id_cambio)::int AS cambios
         FROM par, cambio c JOIN detalle_cambio dc ON dc.id_cambio = c.id_cambio
         JOIN detalle_venta dv ON dv.id_detalle_venta = dc.id_detalle_venta
         JOIN variante_producto vp ON vp.id_variante = dv.id_variante JOIN producto p ON p.id_producto = vp.id_producto
         JOIN venta v ON v.id_venta = c.id_venta
        WHERE c.id_empresa = par.emp AND ${enAlcance('v.id_sucursal')} AND (c.fecha AT TIME ZONE par.tz)::date > ${hoy} - par.dias
        GROUP BY p.id_producto, p.nombre ORDER BY unidades DESC, producto LIMIT 5`,
    );

    const topDevueltas = await consulta(
      `SELECT p.id_producto AS "idProducto", p.nombre AS producto, SUM(dd.cantidad)::int AS unidades
         FROM par, devolucion d JOIN detalle_devolucion dd ON dd.id_devolucion = d.id_devolucion
         JOIN detalle_venta dv ON dv.id_detalle_venta = dd.id_detalle_venta
         JOIN variante_producto vp ON vp.id_variante = dv.id_variante JOIN producto p ON p.id_producto = vp.id_producto
         JOIN venta v ON v.id_venta = d.id_venta
        WHERE d.id_empresa = par.emp AND ${enAlcance('v.id_sucursal')} AND (d.fecha AT TIME ZONE par.tz)::date > ${hoy} - par.dias
        GROUP BY p.id_producto, p.nombre ORDER BY unidades DESC, producto LIMIT 5`,
    );

    // Top 3 prendas más vendidas en cada sucursal (ventana del rango).
    const topPorSucursal: { idSucursal: number; sucursal: string; producto: string; unidades: number; monto: number }[] = await consulta(
      `SELECT * FROM (
         SELECT s.id_sucursal AS "idSucursal", s.nombre AS sucursal, p.nombre AS producto,
                SUM(dv.cantidad - ${DEVUELTAS})::int AS unidades,
                SUM(dv.precio_unitario * (dv.cantidad - ${DEVUELTAS}))::float AS monto,
                ROW_NUMBER() OVER (PARTITION BY s.id_sucursal ORDER BY SUM(dv.cantidad - ${DEVUELTAS}) DESC, p.nombre) AS puesto
           FROM par, venta v JOIN detalle_venta dv ON dv.id_venta = v.id_venta
           JOIN variante_producto vp ON vp.id_variante = dv.id_variante JOIN producto p ON p.id_producto = vp.id_producto
           JOIN sucursal s ON s.id_sucursal = v.id_sucursal
          WHERE ${ventaValida} AND ${rango}
          GROUP BY s.id_sucursal, s.nombre, p.nombre
          HAVING SUM(dv.cantidad - ${DEVUELTAS}) > 0
       ) t WHERE puesto <= 3 ORDER BY sucursal, puesto`,
    );

    const tendencia: { fecha: string; monto: number; ventas: number }[] = await consulta(
      `SELECT TO_CHAR(d, 'YYYY-MM-DD') AS fecha, COALESCE(x.monto, 0)::float AS monto, COALESCE(x.ventas, 0)::int AS ventas
         FROM par, generate_series(${hoy} - (par.dias - 1), ${hoy}, interval '1 day') d
         LEFT JOIN (
           SELECT ${dia} AS f, SUM(dv.precio_unitario * (dv.cantidad - ${DEVUELTAS})) AS monto, COUNT(DISTINCT v.id_venta) AS ventas
             FROM par, venta v JOIN detalle_venta dv ON dv.id_venta = v.id_venta
            WHERE ${ventaValida} AND ${rango} GROUP BY 1
         ) x ON x.f = d::date
        ORDER BY d`,
    );

    const [otros] = await consulta(
      `SELECT
         (SELECT COUNT(*) FROM inventario i WHERE i.id_empresa = par.emp AND ${enAlcance('i.id_sucursal')} AND i.stock_disponible <= ${STOCK_CRITICO}) AS "stockCritico",
         (SELECT COUNT(*) FROM inventario i WHERE i.id_empresa = par.emp AND ${enAlcance('i.id_sucursal')} AND i.stock_disponible = 0) AS agotados,
         (SELECT COUNT(*) FROM reserva r WHERE r.id_empresa = par.emp AND ${enAlcance('r.id_sucursal')} AND r.estado = 'PENDIENTE') AS "reservasPendientes",
         (SELECT COUNT(*) FROM operacion_sync o WHERE o.id_empresa = par.emp AND ${enAlcance('o.id_sucursal')} AND o.estado = 'CONFLICTO' AND o.resuelta = false) AS "conflictosAbiertos"
       FROM par`,
    );

    const n = (x: unknown) => Number(x ?? 0);
    const mes = { monto: n(ventas.mesMonto), cantidad: n(ventas.mesCantidad), unidades: n(ventas.mesUnidades) };
    const brutas = n(ventas.rangoUnidadesBrutas);
    const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null);
    return {
      generadoEn: new Date().toISOString(),
      hoy: tendencia.at(-1)?.fecha ?? null,
      dias,
      sucursal: idSucursal ? permitidas.find((s) => s.idSucursal === idSucursal)!.nombre : null,
      sucursales: permitidas,
      ventasHoy: { monto: n(ventas.hoyMonto), cantidad: n(ventas.hoyCantidad), ayer: n(ventas.ayerMonto), variacion: pct(n(ventas.hoyMonto) - n(ventas.ayerMonto), n(ventas.ayerMonto)) },
      ventasMes: {
        ...mes,
        ticketPromedio: mes.cantidad ? Math.round((mes.monto / mes.cantidad) * 100) / 100 : 0,
        mesAnterior: n(ventas.mesAnteriorMonto),
        variacion: pct(mes.monto - n(ventas.mesAnteriorMonto), n(ventas.mesAnteriorMonto)),
        digital: n(ventas.mesDigital),
        presencial: n(ventas.mesPresencial),
      },
      stockCritico: { variantes: n(otros.stockCritico), agotadas: n(otros.agotados), umbral: STOCK_CRITICO },
      reservasPendientes: n(otros.reservasPendientes),
      conflictosAbiertos: n(otros.conflictosAbiertos),
      devoluciones: { unidadesDevueltas: n(ventas.rangoUnidadesDevueltas), unidadesVendidas: brutas, tasa: pct(n(ventas.rangoUnidadesDevueltas), brutas) },
      cambios: { unidadesCambiadas: n(cambios.unidades), cambios: n(cambios.cambios), tasa: pct(n(cambios.unidades), brutas) },
      topCambiadas,
      topDevueltas,
      topPorSucursal: topPorSucursal.map(({ idSucursal: id, sucursal, producto, unidades, monto }) => ({ idSucursal: id, sucursal, producto, unidades, monto })),
      tendencia,
    };
  }
}
