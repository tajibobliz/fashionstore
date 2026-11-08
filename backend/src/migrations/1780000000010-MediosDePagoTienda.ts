import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * P2c — Medios de pago de la tienda online (todos los planes).
 *
 * `config_pago_tienda`: qué medios acepta cada tienda (tarjeta, QR, transferencia, efectivo al
 * retirar, contra entrega), la imagen de su QR y los datos de su cuenta bancaria. Una por empresa.
 * `comprobante_pago`: la imagen o PDF que sube la clienta al pagar por QR o transferencia, para
 * que el personal lo verifique. Uno por pago.
 * Los archivos se guardan en la base (bytea): el servidor en la nube no conserva archivos en disco.
 * Ambas tablas aisladas por empresa con RLS.
 */
export class MediosDePagoTienda1780000000010 implements MigrationInterface {
  name = 'MediosDePagoTienda1780000000010';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE "comprobante_pago" ("id_empresa" integer NOT NULL, "id_comprobante" SERIAL NOT NULL, "mime" character varying(40) NOT NULL, "nombre" character varying(120), "bytes" integer NOT NULL, "datos" bytea NOT NULL, "subido_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id_pago" integer NOT NULL, CONSTRAINT "PK_7d21b698bb13893b17b82ff3d13" PRIMARY KEY ("id_comprobante"))`,
    );
    await q.query(
      `CREATE INDEX "IDX_48fa1be70a31568b1560aec856" ON "comprobante_pago" ("id_empresa")`,
    );
    await q.query(
      `CREATE UNIQUE INDEX "UQ_comprobante_pago_pago" ON "comprobante_pago" ("id_pago")`,
    );
    await q.query(
      `CREATE TABLE "config_pago_tienda" ("id_empresa" integer NOT NULL, "id_config_pago" SERIAL NOT NULL, "tarjeta" boolean NOT NULL DEFAULT true, "qr" boolean NOT NULL DEFAULT false, "transferencia" boolean NOT NULL DEFAULT false, "efectivo_retiro" boolean NOT NULL DEFAULT true, "contraentrega" boolean NOT NULL DEFAULT false, "qr_imagen" bytea, "qr_mime" character varying(40), "banco" character varying(80), "titular" character varying(120), "numero_cuenta" character varying(40), "tipo_cuenta" character varying(40), "documento_titular" character varying(30), "instrucciones" character varying(300), "actualizado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_7e63457dacb1343c6c73d4b2ae4" PRIMARY KEY ("id_config_pago"))`,
    );
    await q.query(
      `CREATE INDEX "IDX_6793bf07aebe24527efc76dbb2" ON "config_pago_tienda" ("id_empresa")`,
    );
    await q.query(
      `CREATE UNIQUE INDEX "UQ_config_pago_tienda_empresa" ON "config_pago_tienda" ("id_empresa")`,
    );
    await q.query(
      `ALTER TABLE "comprobante_pago" ADD CONSTRAINT "FK_48fa1be70a31568b1560aec8563" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id_empresa") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await q.query(
      `ALTER TABLE "comprobante_pago" ADD CONSTRAINT "FK_0b8a8c2f4d8e6b3cd1a16a89a0d" FOREIGN KEY ("id_pago") REFERENCES "pago"("id_pago") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await q.query(
      `ALTER TABLE "config_pago_tienda" ADD CONSTRAINT "FK_6793bf07aebe24527efc76dbb2f" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id_empresa") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await q.query(`ALTER TABLE "config_pago_tienda" ENABLE ROW LEVEL SECURITY`);
    await q.query(`ALTER TABLE "config_pago_tienda" FORCE ROW LEVEL SECURITY`);
    await q.query(`CREATE POLICY "tenant_isolation" ON "config_pago_tienda"
      USING (app_tenant_matches("id_empresa"))
      WITH CHECK (app_tenant_matches("id_empresa"))`);
    await q.query(`ALTER TABLE "comprobante_pago" ENABLE ROW LEVEL SECURITY`);
    await q.query(`ALTER TABLE "comprobante_pago" FORCE ROW LEVEL SECURITY`);
    await q.query(`CREATE POLICY "tenant_isolation" ON "comprobante_pago"
      USING (app_tenant_matches("id_empresa"))
      WITH CHECK (app_tenant_matches("id_empresa"))`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `DROP POLICY IF EXISTS "tenant_isolation" ON "config_pago_tienda"`,
    );
    await q.query(
      `DROP POLICY IF EXISTS "tenant_isolation" ON "comprobante_pago"`,
    );
    await q.query(
      `ALTER TABLE "config_pago_tienda" DROP CONSTRAINT "FK_6793bf07aebe24527efc76dbb2f"`,
    );
    await q.query(
      `ALTER TABLE "comprobante_pago" DROP CONSTRAINT "FK_0b8a8c2f4d8e6b3cd1a16a89a0d"`,
    );
    await q.query(
      `ALTER TABLE "comprobante_pago" DROP CONSTRAINT "FK_48fa1be70a31568b1560aec8563"`,
    );
    await q.query(`DROP INDEX "public"."UQ_config_pago_tienda_empresa"`);
    await q.query(`DROP INDEX "public"."IDX_6793bf07aebe24527efc76dbb2"`);
    await q.query(`DROP TABLE "config_pago_tienda"`);
    await q.query(`DROP INDEX "public"."UQ_comprobante_pago_pago"`);
    await q.query(`DROP INDEX "public"."IDX_48fa1be70a31568b1560aec856"`);
    await q.query(`DROP TABLE "comprobante_pago"`);
  }
}
