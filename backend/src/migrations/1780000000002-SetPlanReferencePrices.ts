import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Precios de referencia de los planes (Bs/mes) para la página pública del SaaS.
 * Son simulados (no hay cobro real) y se pueden cambiar con PATCH /platform/planes/:id.
 * Solo se fijan si siguen en 0, para no pisar valores editados.
 */
export class SetPlanReferencePrices1780000000002 implements MigrationInterface {
  name = 'SetPlanReferencePrices1780000000002';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`UPDATE "plan" SET "precio_referencia" = CASE "codigo"
        WHEN 'BASICO' THEN 150 WHEN 'PROFESIONAL' THEN 390 WHEN 'EMPRESARIAL' THEN 890 END
      WHERE "precio_referencia" = 0 AND "codigo" IN ('BASICO','PROFESIONAL','EMPRESARIAL')`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`UPDATE "plan" SET "precio_referencia" = 0 WHERE "codigo" IN ('BASICO','PROFESIONAL','EMPRESARIAL')`);
  }
}
