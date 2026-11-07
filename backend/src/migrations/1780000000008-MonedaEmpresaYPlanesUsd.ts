import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Moneda por tienda y planes en dólares.
 *
 * - `empresa.moneda` (ISO 4217, por defecto BOB): la moneda en la que VENDE cada tienda.
 *   Las tiendas existentes quedan en BOB, así que nada cambia para ellas.
 * - Los planes de la plataforma pasan a USD (moneda única del SaaS para todos los países):
 *   Básico 19, Profesional 49, Empresarial 119 por mes (antes 150 / 390 / 890 Bs).
 * - Nueva feature `pagosOnline` = pago diferido de pedidos hechos sin conexión (CU16): solo Empresarial,
 *   el plan más completo. Se puede cambiar desde el panel de la plataforma.
 */
export class MonedaEmpresaYPlanesUsd1780000000008 implements MigrationInterface {
  name = 'MonedaEmpresaYPlanesUsd1780000000008';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "empresa" ADD "moneda" character varying(3) NOT NULL DEFAULT 'BOB'`,
    );
    await q.query(
      `ALTER TABLE "empresa" ADD CONSTRAINT "CHK_empresa_moneda" CHECK (moneda IN ('BOB','USD','ARS','BRL','CLP','COP','EUR','MXN','PEN','PYG'))`,
    );
    await q.query(`UPDATE "plan" SET
        "precio_referencia" = CASE "codigo" WHEN 'BASICO' THEN 19 WHEN 'PROFESIONAL' THEN 49 ELSE 119 END,
        "features" = "features" || jsonb_build_object('pagosOnline', "codigo" = 'EMPRESARIAL')
      WHERE "codigo" IN ('BASICO','PROFESIONAL','EMPRESARIAL')`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`UPDATE "plan" SET
        "precio_referencia" = CASE "codigo" WHEN 'BASICO' THEN 150 WHEN 'PROFESIONAL' THEN 390 ELSE 890 END,
        "features" = "features" - 'pagosOnline'
      WHERE "codigo" IN ('BASICO','PROFESIONAL','EMPRESARIAL')`);
    await q.query(`ALTER TABLE "empresa" DROP CONSTRAINT "CHK_empresa_moneda"`);
    await q.query(`ALTER TABLE "empresa" DROP COLUMN "moneda"`);
  }
}
