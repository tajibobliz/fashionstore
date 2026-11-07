import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * P1 — Traspasos entre sucursales (CU14, RF-025, RN-013).
 *
 * `traspaso` (cabecera, por empresa): origen y destino (sucursal + almacén), estado
 * EN_TRANSITO → RECIBIDO | RECIBIDO_PARCIAL | RECHAZADO | CANCELADO, quién envió y quién cerró.
 * `detalle_traspaso`: cantidad enviada y recibida por variante; la diferencia es la merma.
 * Las CHECK impiden origen = destino y recibir más de lo enviado.
 * `traspaso` lleva la política RLS `tenant_isolation`; el detalle hereda el aislamiento por su
 * cabecera (igual que `detalle_cambio`).
 */
export class AddTraspasos1780000000007 implements MigrationInterface {
  name = 'AddTraspasos1780000000007';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE "detalle_traspaso" ("id_detalle_traspaso" SERIAL NOT NULL, "cantidad_enviada" integer NOT NULL, "cantidad_recibida" integer, "id_traspaso" integer, "id_variante" integer, CONSTRAINT "CHK_detalle_traspaso_recibida" CHECK (cantidad_recibida IS NULL OR (cantidad_recibida >= 0 AND cantidad_recibida <= cantidad_enviada)), CONSTRAINT "CHK_detalle_traspaso_enviada" CHECK (cantidad_enviada > 0), CONSTRAINT "PK_cac0f5eb78e23a740ed676dc77c" PRIMARY KEY ("id_detalle_traspaso"))`,
    );
    await q.query(
      `CREATE TABLE "traspaso" ("id_empresa" integer NOT NULL, "id_traspaso" SERIAL NOT NULL, "estado" character varying(20) NOT NULL DEFAULT 'EN_TRANSITO', "observacion" character varying(300), "fecha_envio" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "fecha_cierre" TIMESTAMP WITH TIME ZONE, "observacion_cierre" character varying(300), "id_sucursal_origen" integer, "id_almacen_origen" integer, "id_sucursal_destino" integer, "id_almacen_destino" integer, "id_usuario_envia" integer, "id_usuario_cierra" integer, CONSTRAINT "CHK_traspaso_sucursales" CHECK (id_sucursal_origen <> id_sucursal_destino), CONSTRAINT "CHK_traspaso_estado" CHECK (estado IN ('EN_TRANSITO','RECIBIDO','RECIBIDO_PARCIAL','RECHAZADO','CANCELADO')), CONSTRAINT "PK_ef5cddb82e17494fb45d908a9fd" PRIMARY KEY ("id_traspaso"))`,
    );
    await q.query(
      `CREATE INDEX "IDX_f43d6deff3a63a0358c1593c2f" ON "traspaso" ("id_empresa")`,
    );
    await q.query(
      `ALTER TABLE "detalle_traspaso" ADD CONSTRAINT "FK_a7b2d5902260e44047e58ff9b41" FOREIGN KEY ("id_traspaso") REFERENCES "traspaso"("id_traspaso") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await q.query(
      `ALTER TABLE "detalle_traspaso" ADD CONSTRAINT "FK_3d239151da362609d093ed84f8e" FOREIGN KEY ("id_variante") REFERENCES "variante_producto"("id_variante") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await q.query(
      `ALTER TABLE "traspaso" ADD CONSTRAINT "FK_f43d6deff3a63a0358c1593c2f6" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id_empresa") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await q.query(
      `ALTER TABLE "traspaso" ADD CONSTRAINT "FK_512674a5b06a3abfeb325341898" FOREIGN KEY ("id_sucursal_origen") REFERENCES "sucursal"("id_sucursal") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await q.query(
      `ALTER TABLE "traspaso" ADD CONSTRAINT "FK_3194162b8af016972c2f5e158ae" FOREIGN KEY ("id_almacen_origen") REFERENCES "almacen"("id_almacen") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await q.query(
      `ALTER TABLE "traspaso" ADD CONSTRAINT "FK_4bd52bfaa785534d83cb02afca5" FOREIGN KEY ("id_sucursal_destino") REFERENCES "sucursal"("id_sucursal") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await q.query(
      `ALTER TABLE "traspaso" ADD CONSTRAINT "FK_15f04bcada1235ec1f2fbfb2850" FOREIGN KEY ("id_almacen_destino") REFERENCES "almacen"("id_almacen") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await q.query(
      `ALTER TABLE "traspaso" ADD CONSTRAINT "FK_1a6aca322e616e923e686419f73" FOREIGN KEY ("id_usuario_envia") REFERENCES "usuario"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await q.query(
      `ALTER TABLE "traspaso" ADD CONSTRAINT "FK_f4b11c18050e71f629f4169fd23" FOREIGN KEY ("id_usuario_cierra") REFERENCES "usuario"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await q.query(
      `CREATE INDEX "IDX_traspaso_estado" ON "traspaso" ("id_empresa", "estado")`,
    );

    // Aislamiento por empresa (misma política que el resto de tablas, ver 1780000000001).
    await q.query(`ALTER TABLE "traspaso" ENABLE ROW LEVEL SECURITY`);
    await q.query(`ALTER TABLE "traspaso" FORCE ROW LEVEL SECURITY`);
    await q.query(`CREATE POLICY "tenant_isolation" ON "traspaso"
      USING (app_tenant_matches("id_empresa"))
      WITH CHECK (app_tenant_matches("id_empresa"))`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "traspaso"`);
    await q.query(`DROP INDEX "public"."IDX_traspaso_estado"`);
    await q.query(
      `ALTER TABLE "traspaso" DROP CONSTRAINT "FK_f4b11c18050e71f629f4169fd23"`,
    );
    await q.query(
      `ALTER TABLE "traspaso" DROP CONSTRAINT "FK_1a6aca322e616e923e686419f73"`,
    );
    await q.query(
      `ALTER TABLE "traspaso" DROP CONSTRAINT "FK_15f04bcada1235ec1f2fbfb2850"`,
    );
    await q.query(
      `ALTER TABLE "traspaso" DROP CONSTRAINT "FK_4bd52bfaa785534d83cb02afca5"`,
    );
    await q.query(
      `ALTER TABLE "traspaso" DROP CONSTRAINT "FK_3194162b8af016972c2f5e158ae"`,
    );
    await q.query(
      `ALTER TABLE "traspaso" DROP CONSTRAINT "FK_512674a5b06a3abfeb325341898"`,
    );
    await q.query(
      `ALTER TABLE "traspaso" DROP CONSTRAINT "FK_f43d6deff3a63a0358c1593c2f6"`,
    );
    await q.query(
      `ALTER TABLE "detalle_traspaso" DROP CONSTRAINT "FK_3d239151da362609d093ed84f8e"`,
    );
    await q.query(
      `ALTER TABLE "detalle_traspaso" DROP CONSTRAINT "FK_a7b2d5902260e44047e58ff9b41"`,
    );
    await q.query(`DROP INDEX "public"."IDX_f43d6deff3a63a0358c1593c2f"`);
    await q.query(`DROP TABLE "traspaso"`);
    await q.query(`DROP TABLE "detalle_traspaso"`);
  }
}
