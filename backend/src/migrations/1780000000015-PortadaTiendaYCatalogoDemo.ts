import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  actualizarCatalogoDemo,
  PORTADA_DEMO,
} from '../tenancy/seeds/catalogo-demo';

/**
 * Portada de la tienda online y catálogo de moda mujer de la tienda demo.
 *
 *   1. `empresa.portada_url` y `empresa.eslogan`: el administrador elige la imagen grande y la
 *      frase de su portada (/t/:slug). Son enlaces y texto en la base: se conservan al desplegar.
 *   2. Si existe la tienda demo Urban Step (local o producción), su catálogo pasa a ser de moda
 *      para mujer con foto en cada prenda (ver tenancy/seeds/catalogo-demo.ts) y recibe una
 *      portada de ejemplo si todavía no tiene una.
 */
export class PortadaTiendaYCatalogoDemo1780000000015 implements MigrationInterface {
  name = 'PortadaTiendaYCatalogoDemo1780000000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "empresa" ADD COLUMN IF NOT EXISTS "portada_url" character varying(500)`,
    );
    await queryRunner.query(
      `ALTER TABLE "empresa" ADD COLUMN IF NOT EXISTS "eslogan" character varying(160)`,
    );

    const [demo] = await queryRunner.query(
      `SELECT id_empresa FROM empresa WHERE slug = 'urban-step'`,
    );
    if (!demo) return;
    await actualizarCatalogoDemo(queryRunner, demo.id_empresa);
    await queryRunner.query(
      `UPDATE empresa SET portada_url = COALESCE(portada_url, $2), eslogan = COALESCE(eslogan, $3)
        WHERE id_empresa = $1`,
      [demo.id_empresa, PORTADA_DEMO.portadaUrl, PORTADA_DEMO.eslogan],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // El catálogo demo es una reparación de datos: no se deshace. Solo se quitan las columnas.
    await queryRunner.query(`ALTER TABLE "empresa" DROP COLUMN "eslogan"`);
    await queryRunner.query(`ALTER TABLE "empresa" DROP COLUMN "portada_url"`);
  }
}
