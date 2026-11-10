import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase 3 SaaS — Reportes generativos con IA (tarea 3.1).
 *
 * `consulta_ia` es la bitácora del arnés: pregunta, herramientas que pidió el modelo (con
 * sus parámetros y si se aceptaron), tokens, duración y estado. Sirve para auditar que la
 * IA no hace consultas arbitrarias y para limitar consultas por minuto
 * (índice por usuario y fecha). Lleva la política RLS `tenant_isolation`.
 */
export class AddConsultaIa1780000000005 implements MigrationInterface {
  name = 'AddConsultaIa1780000000005';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE "consulta_ia" ("id_empresa" integer NOT NULL, "id_consulta_ia" SERIAL NOT NULL, "consulta" character varying(500) NOT NULL, "estado" character varying(20) NOT NULL, "proveedor" character varying(30) NOT NULL, "modelo" character varying(80), "herramientas" jsonb NOT NULL DEFAULT '[]', "iteraciones" smallint NOT NULL DEFAULT '0', "tokens_entrada" integer NOT NULL DEFAULT '0', "tokens_salida" integer NOT NULL DEFAULT '0', "duracion_ms" integer NOT NULL DEFAULT '0', "error" character varying(300), "creada_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id_usuario" integer, CONSTRAINT "PK_26cec39ddd7bdcc203055fd7d29" PRIMARY KEY ("id_consulta_ia"))`,
    );
    await q.query(
      `CREATE INDEX "IDX_b3c22c4efeb9c6c9ebc3d64666" ON "consulta_ia" ("id_empresa")`,
    );
    await q.query(
      `CREATE INDEX "IDX_consulta_ia_usuario_fecha" ON "consulta_ia" ("id_usuario", "creada_en")`,
    );
    await q.query(
      `ALTER TABLE "consulta_ia" ADD CONSTRAINT "FK_b3c22c4efeb9c6c9ebc3d64666d" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id_empresa") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await q.query(
      `ALTER TABLE "consulta_ia" ADD CONSTRAINT "FK_900c4ff7c93cee526406e0af837" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // Aislamiento por empresa (misma política que el resto de tablas, ver 1780000000001).
    await q.query(`ALTER TABLE "consulta_ia" ENABLE ROW LEVEL SECURITY`);
    await q.query(`ALTER TABLE "consulta_ia" FORCE ROW LEVEL SECURITY`);
    await q.query(`CREATE POLICY "tenant_isolation" ON "consulta_ia"
      USING (app_tenant_matches("id_empresa"))
      WITH CHECK (app_tenant_matches("id_empresa"))`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "consulta_ia"`);
    await q.query(`DROP TABLE "consulta_ia"`);
  }
}
