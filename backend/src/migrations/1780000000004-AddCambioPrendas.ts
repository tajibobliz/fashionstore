import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase 2 SaaS — Cambios de prendas (tarea 2.5).
 *
 * `cambio` (cabecera, por empresa) y `detalle_cambio` (qué línea de la venta vuelve y qué
 * variante se entrega, con los dos precios para calcular la diferencia).
 * El plazo usa la columna `empresa.plazo_cambio_dias` que ya existe desde la Fase 1.
 * `cambio` lleva la política RLS `tenant_isolation`; `detalle_cambio` hereda el aislamiento
 * por su cabecera (igual que `detalle_devolucion`).
 */
export class AddCambioPrendas1780000000004 implements MigrationInterface {
  name = 'AddCambioPrendas1780000000004';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE "cambio" ("id_empresa" integer NOT NULL, "id_cambio" SERIAL NOT NULL, "fecha" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "motivo" character varying(300), "diferencia" numeric(12,2) NOT NULL DEFAULT '0', "metodo_pago_diferencia" character varying(30), "id_venta" integer, "id_usuario_registra" integer, CONSTRAINT "PK_e30b578adf83e0194b652f4e998" PRIMARY KEY ("id_cambio"))`,
    );
    await q.query(
      `CREATE INDEX "IDX_19ef4e7ef5b8fa8eb88318b0cc" ON "cambio" ("id_empresa")`,
    );
    await q.query(
      `CREATE TABLE "detalle_cambio" ("id_detalle_cambio" SERIAL NOT NULL, "cantidad" integer NOT NULL, "precio_original" numeric(12,2) NOT NULL, "precio_nuevo" numeric(12,2) NOT NULL, "id_cambio" integer, "id_detalle_venta" integer, "id_variante_entregada" integer, CONSTRAINT "PK_871db46fad93dfaa1cbdfb1255a" PRIMARY KEY ("id_detalle_cambio"))`,
    );
    await q.query(
      `ALTER TABLE "cambio" ADD CONSTRAINT "FK_19ef4e7ef5b8fa8eb88318b0ccc" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id_empresa") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await q.query(
      `ALTER TABLE "cambio" ADD CONSTRAINT "FK_b9de13bd950efca60c3bb28a5f0" FOREIGN KEY ("id_venta") REFERENCES "venta"("id_venta") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await q.query(
      `ALTER TABLE "cambio" ADD CONSTRAINT "FK_0fc4a06c0d8c03f53917aa32139" FOREIGN KEY ("id_usuario_registra") REFERENCES "usuario"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await q.query(
      `ALTER TABLE "detalle_cambio" ADD CONSTRAINT "FK_c2aa75c4008bd7683c80b181d6d" FOREIGN KEY ("id_cambio") REFERENCES "cambio"("id_cambio") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await q.query(
      `ALTER TABLE "detalle_cambio" ADD CONSTRAINT "FK_e84e850adb69feda62133a5c893" FOREIGN KEY ("id_detalle_venta") REFERENCES "detalle_venta"("id_detalle_venta") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await q.query(
      `ALTER TABLE "detalle_cambio" ADD CONSTRAINT "FK_93a4ae2dbcfbb334715baee023a" FOREIGN KEY ("id_variante_entregada") REFERENCES "variante_producto"("id_variante") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // Aislamiento por empresa (misma política que el resto de tablas, ver 1780000000001).
    await q.query(`ALTER TABLE "cambio" ENABLE ROW LEVEL SECURITY`);
    await q.query(`ALTER TABLE "cambio" FORCE ROW LEVEL SECURITY`);
    await q.query(`CREATE POLICY "tenant_isolation" ON "cambio"
      USING (app_tenant_matches("id_empresa"))
      WITH CHECK (app_tenant_matches("id_empresa"))`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "cambio"`);
    await q.query(`DROP TABLE "detalle_cambio"`);
    await q.query(`DROP TABLE "cambio"`);
  }
}
