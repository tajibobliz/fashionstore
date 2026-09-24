import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddImagenTryOnToProducto1764000000000 implements MigrationInterface {
  name = 'AddImagenTryOnToProducto1764000000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE producto ADD COLUMN IF NOT EXISTS imagen_try_on varchar(500)');
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE producto DROP COLUMN IF EXISTS imagen_try_on');
  }
}
