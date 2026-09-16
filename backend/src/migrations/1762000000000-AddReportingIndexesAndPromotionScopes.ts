import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReportingIndexesAndPromotionScopes1762000000000 implements MigrationInterface {
  name = 'AddReportingIndexesAndPromotionScopes1762000000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE INDEX IF NOT EXISTS idx_venta_fecha ON venta(fecha)`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_venta_sucursal_fecha ON venta(id_sucursal,fecha)`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_venta_almacen_fecha ON venta(id_almacen,fecha)`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_venta_tipo_fecha ON venta(tipo_venta,fecha)`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_venta_modalidad_fecha ON venta(modalidad_comercial,fecha)`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_pago_metodo_fecha ON pago(metodo,fecha)`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_turno_caja_estado ON turno_caja(id_caja,estado)`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_detalle_venta_venta ON detalle_venta(id_venta)`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_detalle_venta_variante ON detalle_venta(id_variante)`);
    await q.query(`CREATE TABLE IF NOT EXISTS promocion_categoria (
      id_promocion integer NOT NULL REFERENCES promocion(id_promocion) ON DELETE CASCADE ON UPDATE CASCADE,
      id_categoria integer NOT NULL REFERENCES categoria(id_categoria) ON DELETE CASCADE ON UPDATE CASCADE,
      PRIMARY KEY(id_promocion,id_categoria))`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_promocion_categoria_categoria ON promocion_categoria(id_categoria)`);
    await q.query(`CREATE TABLE IF NOT EXISTS promocion_temporada (
      id_promocion integer NOT NULL REFERENCES promocion(id_promocion) ON DELETE CASCADE ON UPDATE CASCADE,
      id_temporada integer NOT NULL REFERENCES temporada(id_temporada) ON DELETE CASCADE ON UPDATE CASCADE,
      PRIMARY KEY(id_promocion,id_temporada))`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_promocion_temporada_temporada ON promocion_temporada(id_temporada)`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS promocion_temporada`);
    await q.query(`DROP TABLE IF EXISTS promocion_categoria`);
    await q.query(`DROP INDEX IF EXISTS idx_detalle_venta_variante, idx_detalle_venta_venta, idx_turno_caja_estado, idx_pago_metodo_fecha, idx_venta_modalidad_fecha, idx_venta_tipo_fecha, idx_venta_almacen_fecha, idx_venta_sucursal_fecha, idx_venta_fecha`);
  }
}
