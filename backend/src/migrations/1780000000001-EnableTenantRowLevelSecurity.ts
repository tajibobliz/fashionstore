import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase 1 SaaS — Aislamiento entre empresas en la propia base de datos (Row Level Security).
 *
 * RLS = PostgreSQL filtra automáticamente las filas de cada tabla según una "política".
 * El backend fija, por cada conexión, la variable de sesión `app.tenant_id` con la empresa
 * del usuario (ver `tenant-rls.ts`). Con eso:
 *   - SELECT/UPDATE/DELETE solo ven filas de esa empresa (USING).
 *   - INSERT/UPDATE no pueden escribir filas de otra empresa (WITH CHECK).
 * Si `app.tenant_id` está vacía (migraciones, seeds, SUPER_ADMIN) no se filtra.
 *
 * FORCE hace que la política también aplique al dueño de las tablas (el usuario de la app
 * en producción). Los superusuarios de PostgreSQL siempre ignoran RLS: en desarrollo local
 * conectarse con un rol normal (ver backend/scripts/crear-rol-app.sql).
 */
export class EnableTenantRowLevelSecurity1780000000001 implements MigrationInterface {
  name = 'EnableTenantRowLevelSecurity1780000000001';

  private readonly tables = [
    'usuario',
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

  async up(q: QueryRunner): Promise<void> {
    // true si la fila pertenece a la empresa de la sesión (o si no hay empresa fijada).
    await q.query(`CREATE OR REPLACE FUNCTION app_tenant_matches(row_tenant integer) RETURNS boolean
      LANGUAGE sql STABLE AS $$
        SELECT coalesce(nullif(current_setting('app.tenant_id', true), ''), '*') = '*'
            OR row_tenant = nullif(current_setting('app.tenant_id', true), '')::integer
      $$`);
    for (const t of this.tables) {
      await q.query(`ALTER TABLE "${t}" ENABLE ROW LEVEL SECURITY`);
      await q.query(`ALTER TABLE "${t}" FORCE ROW LEVEL SECURITY`);
      await q.query(`CREATE POLICY "tenant_isolation" ON "${t}"
        USING (app_tenant_matches("id_empresa"))
        WITH CHECK (app_tenant_matches("id_empresa"))`);
    }
  }

  async down(q: QueryRunner): Promise<void> {
    for (const t of [...this.tables].reverse()) {
      await q.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "${t}"`);
      await q.query(`ALTER TABLE "${t}" NO FORCE ROW LEVEL SECURITY`);
      await q.query(`ALTER TABLE "${t}" DISABLE ROW LEVEL SECURITY`);
    }
    await q.query(`DROP FUNCTION IF EXISTS app_tenant_matches(integer)`);
  }
}
