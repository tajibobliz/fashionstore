import { EntityManager } from 'typeorm';
import { DetalleDevolucion } from '../returns/entities/detalle-devolucion.entity';
import { DetalleCambio } from './entities/detalle-cambio.entity';

/** Unidades de cada línea de venta que ya se devolvieron o se cambiaron. */
export async function unidadesProcesadas(
  manager: EntityManager,
  idVenta: number,
) {
  const devueltas = await manager
    .getRepository(DetalleDevolucion)
    .createQueryBuilder('dd')
    .select('dd.id_detalle_venta', 'id')
    .addSelect('SUM(dd.cantidad)', 'cantidad')
    .innerJoin('dd.devolucion', 'd')
    .where('d.id_venta = :idVenta', { idVenta })
    .groupBy('dd.id_detalle_venta')
    .getRawMany<{ id: string; cantidad: string }>();
  const cambiadas = await manager
    .getRepository(DetalleCambio)
    .createQueryBuilder('dc')
    .select('dc.id_detalle_venta', 'id')
    .addSelect('SUM(dc.cantidad)', 'cantidad')
    .innerJoin('dc.cambio', 'c')
    .where('c.id_venta = :idVenta', { idVenta })
    .groupBy('dc.id_detalle_venta')
    .getRawMany<{ id: string; cantidad: string }>();
  const mapa = (filas: { id: string; cantidad: string }[]) =>
    new Map(filas.map((f) => [Number(f.id), Number(f.cantidad)]));
  return { devueltas: mapa(devueltas), cambiadas: mapa(cambiadas) };
}
