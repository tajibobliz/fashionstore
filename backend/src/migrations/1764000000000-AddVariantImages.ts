import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVariantImages1764000000000 implements MigrationInterface {
  name = 'AddVariantImages1764000000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS imagen_variante (
      id_imagen SERIAL PRIMARY KEY,
      id_variante integer NOT NULL REFERENCES variante_producto(id_variante) ON DELETE CASCADE,
      url varchar(500) NOT NULL,
      orden smallint NOT NULL,
      principal boolean NOT NULL DEFAULT false,
      CONSTRAINT chk_imagen_variante_orden CHECK (orden BETWEEN 1 AND 3),
      CONSTRAINT uq_imagen_variante_orden UNIQUE (id_variante, orden)
    )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_imagen_variante_principal
      ON imagen_variante (id_variante) WHERE principal`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE IF EXISTS imagen_variante');
  }
}
