import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWholesaleCounterpaymentIdempotency1761000000000 implements MigrationInterface {
  name = 'AddWholesaleCounterpaymentIdempotency1761000000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE producto
      ADD COLUMN IF NOT EXISTS precio_mayorista numeric(12,2),
      ADD COLUMN IF NOT EXISTS cantidad_minima_mayorista integer`);
    await q.query(`ALTER TABLE producto
      ADD CONSTRAINT chk_producto_precio_mayorista CHECK (precio_mayorista IS NULL OR precio_mayorista >= 0),
      ADD CONSTRAINT chk_producto_cantidad_minima_mayorista CHECK (cantidad_minima_mayorista IS NULL OR cantidad_minima_mayorista > 0)`);

    await q.query(`ALTER TABLE venta
      ADD COLUMN IF NOT EXISTS modalidad_comercial varchar(20),
      ADD COLUMN IF NOT EXISTS client_request_id uuid`);
    await q.query(`UPDATE venta SET modalidad_comercial='MINORISTA' WHERE modalidad_comercial IS NULL`);
    await q.query(`ALTER TABLE venta ALTER COLUMN modalidad_comercial SET DEFAULT 'MINORISTA', ALTER COLUMN modalidad_comercial SET NOT NULL`);
    await q.query(`ALTER TABLE venta ADD CONSTRAINT chk_venta_modalidad_comercial CHECK (modalidad_comercial IN ('MINORISTA','MAYORISTA'))`);
    await q.query(`CREATE UNIQUE INDEX uq_venta_digital_client_request
      ON venta(id_usuario,client_request_id)
      WHERE client_request_id IS NOT NULL AND tipo_venta='DIGITAL'`);
    await q.query(`CREATE UNIQUE INDEX uq_venta_pos_client_request
      ON venta(id_cajero,id_turno,client_request_id)
      WHERE client_request_id IS NOT NULL AND tipo_venta='PRESENCIAL'`);

    await q.query(`ALTER TABLE reserva ADD COLUMN IF NOT EXISTS client_request_id uuid`);
    await q.query(`CREATE UNIQUE INDEX uq_reserva_usuario_client_request
      ON reserva(id_usuario,client_request_id) WHERE client_request_id IS NOT NULL`);

    await q.query(`ALTER TABLE pago ADD COLUMN IF NOT EXISTS client_request_id uuid`);
    await q.query(`CREATE UNIQUE INDEX uq_pago_venta_client_request
      ON pago(id_venta,client_request_id) WHERE client_request_id IS NOT NULL`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS uq_pago_venta_client_request`);
    await q.query(`ALTER TABLE pago DROP COLUMN IF EXISTS client_request_id`);
    await q.query(`DROP INDEX IF EXISTS uq_reserva_usuario_client_request`);
    await q.query(`ALTER TABLE reserva DROP COLUMN IF EXISTS client_request_id`);
    await q.query(`DROP INDEX IF EXISTS uq_venta_pos_client_request`);
    await q.query(`DROP INDEX IF EXISTS uq_venta_digital_client_request`);
    await q.query(`ALTER TABLE venta DROP CONSTRAINT IF EXISTS chk_venta_modalidad_comercial, DROP COLUMN IF EXISTS client_request_id, DROP COLUMN IF EXISTS modalidad_comercial`);
    await q.query(`ALTER TABLE producto DROP CONSTRAINT IF EXISTS chk_producto_cantidad_minima_mayorista, DROP CONSTRAINT IF EXISTS chk_producto_precio_mayorista, DROP COLUMN IF EXISTS cantidad_minima_mayorista, DROP COLUMN IF EXISTS precio_mayorista`);
  }
}
