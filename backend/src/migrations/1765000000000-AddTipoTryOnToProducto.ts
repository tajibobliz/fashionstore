import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTipoTryOnToProducto1765000000000 implements MigrationInterface {
  name = 'AddTipoTryOnToProducto1765000000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE producto ADD COLUMN IF NOT EXISTS tipo_try_on varchar(20)');
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE producto DROP COLUMN IF EXISTS tipo_try_on');
  }
}
