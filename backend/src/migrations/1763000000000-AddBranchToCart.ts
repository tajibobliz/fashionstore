import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBranchToCart1763000000000 implements MigrationInterface {
  name = 'AddBranchToCart1763000000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE carrito ADD COLUMN IF NOT EXISTS id_sucursal integer');
    await q.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_carrito_sucursal') THEN
        ALTER TABLE carrito ADD CONSTRAINT fk_carrito_sucursal FOREIGN KEY (id_sucursal) REFERENCES sucursal(id_sucursal);
      END IF;
    END $$;`);
    await q.query("CREATE INDEX IF NOT EXISTS idx_carrito_usuario_sucursal_activo ON carrito (id_usuario, id_sucursal) WHERE estado = 'ACTIVO'");
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP INDEX IF EXISTS idx_carrito_usuario_sucursal_activo');
    await q.query('ALTER TABLE carrito DROP CONSTRAINT IF EXISTS fk_carrito_sucursal');
    await q.query('ALTER TABLE carrito DROP COLUMN IF EXISTS id_sucursal');
  }
}
