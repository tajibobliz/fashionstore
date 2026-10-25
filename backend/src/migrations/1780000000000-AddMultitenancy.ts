import {
  DefaultNamingStrategy,
  MigrationInterface,
  QueryRunner,
} from 'typeorm';

/**
 * Fase 1 SaaS — Multitenant con base compartida y aislamiento lógico.
 *
 * 1. Crea `plan`, `empresa` y `suscripcion` y carga los 3 planes.
 * 2. Crea la Empresa A ("FashionStore", slug `fashionstore`) con plan PROFESIONAL
 *    y le asigna TODOS los datos existentes (compatibilidad con producción).
 * 3. Agrega `id_empresa` (FK + índice) a cada tabla de negocio.
 * 4. Cambia los UNIQUE globales por UNIQUE por empresa
 *    (email, categoría, talla, SKU, código de reserva, comprobante, sucursal).
 *
 * Los nombres de índices/FK se generan con la misma estrategia que usa TypeORM,
 * así la BD queda idéntica a lo que declaran las entidades.
 *
 * `down()` revierte todo, pero solo funciona mientras no existan datos repetidos
 * entre empresas (p. ej. dos empresas con la talla "M").
 */
export class AddMultitenancy1780000000000 implements MigrationInterface {
  name = 'AddMultitenancy1780000000000';

  /** Tablas de negocio que pertenecen a una empresa. `usuario` se trata aparte (nullable). */
  private readonly tenantTables = [
    'sucursal',
    'almacen',
    'caja',
    'turno_caja',
    'categoria',
    'talla',
    'color',
    'temporada',
    'coleccion',
    'proveedor',
    'producto',
    'variante_producto',
    'inventario',
    'movimiento_inventario',
    'carrito',
    'venta',
    'pago',
    'reserva',
    'devolucion',
    'promocion',
    'interaccion_cliente',
  ];

  /** UNIQUE de una columna que pasan a ser UNIQUE (id_empresa, columna). */
  private readonly perTenantUniques: Array<{
    table: string;
    columns: string[];
    name: string;
  }> = [
    { table: 'usuario', columns: ['email'], name: 'UQ_usuario_empresa_email' },
    {
      table: 'categoria',
      columns: ['nombre'],
      name: 'UQ_categoria_empresa_nombre',
    },
    { table: 'talla', columns: ['nombre'], name: 'UQ_talla_empresa_nombre' },
    {
      table: 'variante_producto',
      columns: ['sku'],
      name: 'UQ_variante_empresa_sku',
    },
    {
      table: 'reserva',
      columns: ['codigo'],
      name: 'UQ_reserva_empresa_codigo',
    },
    {
      table: 'venta',
      columns: ['numero_comprobante'],
      name: 'UQ_venta_empresa_comprobante',
    },
    {
      table: 'sucursal',
      columns: ['id_ciudad', 'nombre'],
      name: 'UQ_sucursal_empresa_ciudad_nombre',
    },
  ];

  private readonly naming = new DefaultNamingStrategy();

  async up(q: QueryRunner): Promise<void> {
    // ---------- 1. Tablas SaaS ----------
    await q.query(`CREATE TABLE "empresa" (
      "id_empresa" SERIAL NOT NULL,
      "nombre" character varying(150) NOT NULL,
      "slug" character varying(60) NOT NULL,
      "nit" character varying(30),
      "estado" character varying(20) NOT NULL DEFAULT 'ACTIVA',
      "plazo_cambio_dias" integer NOT NULL DEFAULT '7',
      "created_at" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "${this.naming.uniqueConstraintName('empresa', ['slug'])}" UNIQUE ("slug"),
      CONSTRAINT "${this.naming.primaryKeyName('empresa', ['id_empresa'])}" PRIMARY KEY ("id_empresa"))`);

    await q.query(`CREATE TABLE "plan" (
      "id_plan" SERIAL NOT NULL,
      "codigo" character varying(30) NOT NULL,
      "nombre" character varying(80) NOT NULL,
      "max_sucursales" integer,
      "max_usuarios" integer,
      "features" jsonb NOT NULL DEFAULT '{}',
      "precio_referencia" numeric(12,2) NOT NULL DEFAULT '0',
      "activo" boolean NOT NULL DEFAULT true,
      "created_at" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "${this.naming.uniqueConstraintName('plan', ['codigo'])}" UNIQUE ("codigo"),
      CONSTRAINT "${this.naming.primaryKeyName('plan', ['id_plan'])}" PRIMARY KEY ("id_plan"))`);

    await q.query(`CREATE TABLE "suscripcion" (
      "id_suscripcion" SERIAL NOT NULL,
      "fecha_inicio" date NOT NULL,
      "fecha_vencimiento" date NOT NULL,
      "estado" character varying(20) NOT NULL DEFAULT 'ACTIVA',
      "created_at" TIMESTAMP NOT NULL DEFAULT now(),
      "id_empresa" integer NOT NULL,
      "id_plan" integer NOT NULL,
      CONSTRAINT "${this.naming.primaryKeyName('suscripcion', ['id_suscripcion'])}" PRIMARY KEY ("id_suscripcion"))`);
    await q.query(
      `CREATE UNIQUE INDEX "UQ_suscripcion_activa_empresa" ON "suscripcion" ("id_empresa") WHERE estado = 'ACTIVA'`,
    );
    await q.query(`ALTER TABLE "suscripcion" ADD CONSTRAINT "${this.naming.foreignKeyName('suscripcion', ['id_empresa'])}"
      FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id_empresa") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await q.query(`ALTER TABLE "suscripcion" ADD CONSTRAINT "${this.naming.foreignKeyName('suscripcion', ['id_plan'])}"
      FOREIGN KEY ("id_plan") REFERENCES "plan"("id_plan") ON DELETE NO ACTION ON UPDATE NO ACTION`);

    // ---------- 2. Datos iniciales ----------
    // Límites configurables (NULL = ilimitado). Básico/Profesional según el enunciado §9.4.
    await q.query(`INSERT INTO "plan" ("codigo","nombre","max_sucursales","max_usuarios","features","precio_referencia") VALUES
      ('BASICO','Básico',2,5,'{"aiReports":false,"ml":false}',0),
      ('PROFESIONAL','Profesional',10,20,'{"aiReports":true,"ml":false}',0),
      ('EMPRESARIAL','Empresarial',NULL,NULL,'{"aiReports":true,"ml":true}',0)`);

    const [empresaA] = await q.query(
      `INSERT INTO "empresa" ("nombre","slug") VALUES ('FashionStore','fashionstore') RETURNING "id_empresa"`,
    );
    const idA = Number(empresaA.id_empresa);
    await q.query(
      `INSERT INTO "suscripcion" ("id_empresa","id_plan","fecha_inicio","fecha_vencimiento","estado")
       SELECT $1, "id_plan", CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year', 'ACTIVA' FROM "plan" WHERE "codigo" = 'PROFESIONAL'`,
      [idA],
    );
    await q.query(`INSERT INTO "rol" ("nombre","descripcion")
      SELECT 'SUPER_ADMIN','Administrador de la plataforma SaaS'
      WHERE NOT EXISTS (SELECT 1 FROM "rol" WHERE "nombre" = 'SUPER_ADMIN')`);

    // ---------- 3. id_empresa en tablas de negocio (backfill a Empresa A) ----------
    await this.addTenantColumn(q, 'usuario', idA, true);
    for (const table of this.tenantTables)
      await this.addTenantColumn(q, table, idA, false);

    // ---------- 4. UNIQUE globales -> UNIQUE por empresa ----------
    for (const u of this.perTenantUniques) {
      await this.dropUniqueOn(q, u.table, u.columns);
      const cols = ['id_empresa', ...u.columns].map((c) => `"${c}"`).join(', ');
      await q.query(
        `ALTER TABLE "${u.table}" ADD CONSTRAINT "${u.name}" UNIQUE (${cols})`,
      );
    }
    // Usuarios de plataforma (sin empresa): email único entre ellos.
    await q.query(
      `CREATE UNIQUE INDEX "UQ_usuario_email_plataforma" ON "usuario" ("email") WHERE id_empresa IS NULL`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "UQ_usuario_email_plataforma"`);
    for (const u of [...this.perTenantUniques].reverse()) {
      await q.query(
        `ALTER TABLE "${u.table}" DROP CONSTRAINT IF EXISTS "${u.name}"`,
      );
      const cols = u.columns.map((c) => `"${c}"`).join(', ');
      await q.query(
        `ALTER TABLE "${u.table}" ADD CONSTRAINT "${this.naming.uniqueConstraintName(u.table, u.columns)}" UNIQUE (${cols})`,
      );
    }
    for (const table of [...this.tenantTables].reverse())
      await this.dropTenantColumn(q, table);
    await this.dropTenantColumn(q, 'usuario');

    await q.query(`DELETE FROM "rol" WHERE "nombre" = 'SUPER_ADMIN'
      AND NOT EXISTS (SELECT 1 FROM "usuario" u WHERE u."id_rol" = "rol"."id_rol")`);
    await q.query(`DROP TABLE "suscripcion"`);
    await q.query(`DROP TABLE "plan"`);
    await q.query(`DROP TABLE "empresa"`);
  }

  /** Agrega id_empresa (nullable) -> backfill -> NOT NULL -> índice y FK. */
  private async addTenantColumn(
    q: QueryRunner,
    table: string,
    idEmpresa: number,
    nullable: boolean,
  ) {
    await q.query(`ALTER TABLE "${table}" ADD "id_empresa" integer`);
    await q.query(`UPDATE "${table}" SET "id_empresa" = $1`, [idEmpresa]);
    if (!nullable)
      await q.query(
        `ALTER TABLE "${table}" ALTER COLUMN "id_empresa" SET NOT NULL`,
      );
    await q.query(
      `CREATE INDEX "${this.naming.indexName(table, ['id_empresa'])}" ON "${table}" ("id_empresa")`,
    );
    await q.query(`ALTER TABLE "${table}" ADD CONSTRAINT "${this.naming.foreignKeyName(table, ['id_empresa'])}"
      FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id_empresa") ON DELETE RESTRICT ON UPDATE NO ACTION`);
  }

  private async dropTenantColumn(q: QueryRunner, table: string) {
    await q.query(
      `ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${this.naming.foreignKeyName(table, ['id_empresa'])}"`,
    );
    await q.query(
      `DROP INDEX IF EXISTS "${this.naming.indexName(table, ['id_empresa'])}"`,
    );
    await q.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "id_empresa"`);
  }

  /**
   * Elimina el UNIQUE que exista sobre exactamente esas columnas, sin importar su nombre.
   * En producción el nombre depende de si la tabla la creó `synchronize` (UQ_<hash>)
   * o una migración antigua (<tabla>_<col>_key), por eso se busca en el catálogo.
   */
  private async dropUniqueOn(q: QueryRunner, table: string, columns: string[]) {
    const rows: Array<{ conname: string }> = await q.query(
      `SELECT c.conname
         FROM pg_constraint c
         JOIN pg_class t ON t.oid = c.conrelid
        WHERE c.contype = 'u' AND t.relname = $1
          AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
                 FROM unnest(c.conkey) k JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k)
              = (SELECT array_agg(x ORDER BY x) FROM unnest($2::text[]) x)`,
      [table, columns],
    );
    for (const r of rows)
      await q.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${r.conname}"`);
    // Por si existiera como índice único suelto (sin constraint).
    const idx: Array<{ indexname: string }> = await q.query(
      `SELECT i.relname AS indexname
         FROM pg_index x
         JOIN pg_class i ON i.oid = x.indexrelid
         JOIN pg_class t ON t.oid = x.indrelid
        WHERE x.indisunique AND NOT x.indisprimary AND t.relname = $1 AND x.indpred IS NULL
          AND NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conindid = x.indexrelid)
          AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
                 FROM unnest(x.indkey::int2[]) k JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k)
              = (SELECT array_agg(y ORDER BY y) FROM unnest($2::text[]) y)`,
      [table, columns],
    );
    for (const r of idx) await q.query(`DROP INDEX "${r.indexname}"`);
  }
}
