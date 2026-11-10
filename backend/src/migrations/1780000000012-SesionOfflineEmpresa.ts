import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * P3 / CU17 — Sesión offline con PIN: plazo máximo (horas) que cada empresa permite operar
 * sin conexión desde la última vez en línea. Por defecto 72 h; entre 1 h y 30 días.
 */
export class SesionOfflineEmpresa1780000000012 implements MigrationInterface {
  name = 'SesionOfflineEmpresa1780000000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "empresa" ADD "horas_sesion_offline" integer NOT NULL DEFAULT '72'`,
    );
    await queryRunner.query(
      `ALTER TABLE "empresa" ADD CONSTRAINT "CHK_empresa_horas_sesion_offline" CHECK (horas_sesion_offline BETWEEN 1 AND 720)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "empresa" DROP CONSTRAINT "CHK_empresa_horas_sesion_offline"`,
    );
    await queryRunner.query(
      `ALTER TABLE "empresa" DROP COLUMN "horas_sesion_offline"`,
    );
  }
}
