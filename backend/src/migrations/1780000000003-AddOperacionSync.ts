import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase 2 SaaS — Bitácora de sincronización offline (tabla `operacion_sync`).
 *
 * Cada venta o reserva hecha sin conexión y enviada por /sync/operations deja una fila:
 * - `operation_id` (UUID del dispositivo) es único por empresa → idempotencia: si el
 *   dispositivo reenvía la misma operación, el servidor devuelve el mismo resultado.
 * - `estado` CONFIRMADA | RECHAZADA | CONFLICTO y `conflictos` (STOCK, SIN_STOCK, PRECIO,
 *   TURNO_CERRADO) alimentan el panel de conflictos del encargado.
 * La tabla pertenece a una empresa, así que también lleva la política RLS `tenant_isolation`.
 */
export class AddOperacionSync1780000000003 implements MigrationInterface {
  name = 'AddOperacionSync1780000000003';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE "operacion_sync" ("id_empresa" integer NOT NULL, "id_operacion_sync" SERIAL NOT NULL, "operation_id" uuid NOT NULL, "device_id" character varying(100) NOT NULL, "tipo" character varying(20) NOT NULL, "estado" character varying(20) NOT NULL, "conflictos" character varying(100), "motivo" character varying(300), "server_id" integer, "creada_local_en" TIMESTAMP WITH TIME ZONE NOT NULL, "recibida_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actualizada_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "intentos" integer NOT NULL DEFAULT '1', "detalle" jsonb, "resuelta" boolean NOT NULL DEFAULT false, "resuelta_en" TIMESTAMP WITH TIME ZONE, "nota_resolucion" character varying(300), "id_sucursal" integer, "id_usuario" integer, "id_usuario_resolucion" integer, CONSTRAINT "UQ_operacion_sync_empresa_operacion" UNIQUE ("id_empresa", "operation_id"), CONSTRAINT "PK_9ac6a8eeab62737c29b012f2ffa" PRIMARY KEY ("id_operacion_sync"))`,
    );
    await q.query(
      `CREATE INDEX "IDX_4c888aff71895f38ec11ce9a45" ON "operacion_sync" ("id_empresa")`,
    );
    await q.query(
      `ALTER TABLE "operacion_sync" ADD CONSTRAINT "FK_4c888aff71895f38ec11ce9a454" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id_empresa") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await q.query(
      `ALTER TABLE "operacion_sync" ADD CONSTRAINT "FK_da3bbaf9b9a9803c3982a97342c" FOREIGN KEY ("id_sucursal") REFERENCES "sucursal"("id_sucursal") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await q.query(
      `ALTER TABLE "operacion_sync" ADD CONSTRAINT "FK_87cfa0f6ecd9190a95e81138559" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await q.query(
      `ALTER TABLE "operacion_sync" ADD CONSTRAINT "FK_9f8b774f9973dffdfe36b9c4b50" FOREIGN KEY ("id_usuario_resolucion") REFERENCES "usuario"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // Aislamiento por empresa (misma política que el resto de tablas, ver 1780000000001).
    await q.query(`ALTER TABLE "operacion_sync" ENABLE ROW LEVEL SECURITY`);
    await q.query(`ALTER TABLE "operacion_sync" FORCE ROW LEVEL SECURITY`);
    await q.query(`CREATE POLICY "tenant_isolation" ON "operacion_sync"
      USING (app_tenant_matches("id_empresa"))
      WITH CHECK (app_tenant_matches("id_empresa"))`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `DROP POLICY IF EXISTS "tenant_isolation" ON "operacion_sync"`,
    );
    await q.query(`DROP TABLE "operacion_sync"`);
  }
}
