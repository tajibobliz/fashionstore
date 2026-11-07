import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase 3 SaaS — El plan Profesional incluye la analítica con ML.
 *
 * El CU12 (Consultar dashboard analítico) del documento ICONIX exige "plan Profesional"
 * para el dashboard con modelos de ML; antes solo lo tenía Empresarial.
 * Solo cambia datos (no esquema). El SUPER_ADMIN puede ajustarlo luego en Planes.
 */
export class PlanProfesionalConMl1780000000006 implements MigrationInterface {
  name = 'PlanProfesionalConMl1780000000006';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `UPDATE "plan" SET "features" = "features" || '{"ml": true}'::jsonb WHERE "codigo" = 'PROFESIONAL'`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `UPDATE "plan" SET "features" = "features" || '{"ml": false}'::jsonb WHERE "codigo" = 'PROFESIONAL'`,
    );
  }
}
