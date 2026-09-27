import { MigrationInterface, QueryRunner } from 'typeorm';

export class CatalogTryOnAndBranchScope1767000000000 implements MigrationInterface {
  name = 'CatalogTryOnAndBranchScope1767000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE producto ADD COLUMN IF NOT EXISTS imagen_catalogo_url varchar(500), ADD COLUMN IF NOT EXISTS imagen_vestidor_url varchar(500), ADD COLUMN IF NOT EXISTS tipo_prenda_vestidor varchar(20), ADD COLUMN IF NOT EXISTS id_sucursal_origen integer REFERENCES sucursal(id_sucursal) ON DELETE SET NULL`);
    await queryRunner.query(`UPDATE producto SET imagen_catalogo_url=imagen_url WHERE imagen_catalogo_url IS NULL`);
    await queryRunner.query(`UPDATE producto SET imagen_vestidor_url=imagen_try_on WHERE imagen_vestidor_url IS NULL`);
    await queryRunner.query(`UPDATE producto SET tipo_prenda_vestidor=CASE LOWER(tipo_try_on) WHEN 'gorra' THEN 'GORRA' WHEN 'polera' THEN 'TOP' ELSE NULL END WHERE tipo_prenda_vestidor IS NULL`);
    await queryRunner.query(`ALTER TABLE variante_producto ADD COLUMN IF NOT EXISTS imagen_vestidor_url varchar(500)`);
    for (const table of ['categoria', 'talla', 'color']) {
      await queryRunner.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS id_sucursal integer REFERENCES sucursal(id_sucursal) ON DELETE CASCADE`);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['color', 'talla', 'categoria']) {
      await queryRunner.query(`ALTER TABLE ${table} DROP COLUMN IF EXISTS id_sucursal`);
    }
    await queryRunner.query(`ALTER TABLE variante_producto DROP COLUMN IF EXISTS imagen_vestidor_url`);
    await queryRunner.query(`ALTER TABLE producto DROP COLUMN IF EXISTS id_sucursal_origen, DROP COLUMN IF EXISTS tipo_prenda_vestidor, DROP COLUMN IF EXISTS imagen_vestidor_url, DROP COLUMN IF EXISTS imagen_catalogo_url`);
  }
}
