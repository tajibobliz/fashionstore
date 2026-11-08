import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * P2 / CU16 — Pago diferido de pedidos hechos sin conexión (plan Empresarial, feature `pagosOnline`).
 * - `pago_diferido`: el pedido llegó por sincronización y se paga después.
 * - `pago_vence_en`: plazo para pagarlo; vencido, se cancela (EXPIRADO).
 * - `total_estimado`: total que vio la clienta offline; si difiere del cobrado debe aceptarlo.
 * El índice parcial acelera la tarea que busca pedidos vencidos.
 */
export class PagoDiferidoOffline1780000000011 implements MigrationInterface {
  name = 'PagoDiferidoOffline1780000000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "venta" ADD "pago_diferido" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "venta" ADD "pago_vence_en" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "venta" ADD "total_estimado" numeric(12,2)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_venta_pago_diferido_vence" ON "venta" ("pago_vence_en") WHERE "pago_diferido" AND "estado" = 'PENDIENTE'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_venta_pago_diferido_vence"`);
    await queryRunner.query(`ALTER TABLE "venta" DROP COLUMN "total_estimado"`);
    await queryRunner.query(`ALTER TABLE "venta" DROP COLUMN "pago_vence_en"`);
    await queryRunner.query(`ALTER TABLE "venta" DROP COLUMN "pago_diferido"`);
  }
}
