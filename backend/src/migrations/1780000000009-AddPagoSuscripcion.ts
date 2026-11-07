import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Pago de la suscripción con Stripe Checkout (o pasarela simulada).
 *
 * `pago_suscripcion`: cada intento de pago de un plan (USD), con la referencia de la sesión
 * de checkout (única, para no activar dos veces), su estado PENDIENTE → PAGADO | CANCELADO |
 * EXPIRADO y la suscripción que se creó al confirmarse. Aislada por empresa con RLS: el webhook
 * de Stripe la actualiza en modo plataforma.
 */
export class AddPagoSuscripcion1780000000009 implements MigrationInterface {
  name = 'AddPagoSuscripcion1780000000009';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE "pago_suscripcion" ("id_empresa" integer NOT NULL, "id_pago_suscripcion" SERIAL NOT NULL, "referencia" character varying(255) NOT NULL, "proveedor" character varying(20) NOT NULL, "codigo_plan" character varying(20) NOT NULL, "meses" integer NOT NULL, "monto" numeric(12,2) NOT NULL, "moneda" character varying(3) NOT NULL DEFAULT 'USD', "estado" character varying(20) NOT NULL DEFAULT 'PENDIENTE', "id_usuario" integer, "id_suscripcion" integer, "id_cobro_pasarela" character varying(255), "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "pagado_en" TIMESTAMP WITH TIME ZONE, CONSTRAINT "CHK_pago_suscripcion_meses" CHECK (meses BETWEEN 1 AND 12), CONSTRAINT "CHK_pago_suscripcion_estado" CHECK (estado IN ('PENDIENTE','PAGADO','CANCELADO','EXPIRADO')), CONSTRAINT "PK_51ea504d8ce144d923a5c7957a4" PRIMARY KEY ("id_pago_suscripcion"))`,
    );
    await q.query(
      `CREATE INDEX "IDX_30902f99674f5057a376eac108" ON "pago_suscripcion" ("id_empresa")`,
    );
    await q.query(
      `CREATE UNIQUE INDEX "UQ_pago_suscripcion_referencia" ON "pago_suscripcion" ("referencia")`,
    );
    await q.query(
      `ALTER TABLE "pago_suscripcion" ADD CONSTRAINT "FK_30902f99674f5057a376eac108a" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id_empresa") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await q.query(`ALTER TABLE "pago_suscripcion" ENABLE ROW LEVEL SECURITY`);
    await q.query(`ALTER TABLE "pago_suscripcion" FORCE ROW LEVEL SECURITY`);
    await q.query(`CREATE POLICY "tenant_isolation" ON "pago_suscripcion"
      USING (app_tenant_matches("id_empresa"))
      WITH CHECK (app_tenant_matches("id_empresa"))`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `DROP POLICY IF EXISTS "tenant_isolation" ON "pago_suscripcion"`,
    );
    await q.query(
      `ALTER TABLE "pago_suscripcion" DROP CONSTRAINT "FK_30902f99674f5057a376eac108a"`,
    );
    await q.query(`DROP INDEX "public"."UQ_pago_suscripcion_referencia"`);
    await q.query(`DROP INDEX "public"."IDX_30902f99674f5057a376eac108"`);
    await q.query(`DROP TABLE "pago_suscripcion"`);
  }
}
