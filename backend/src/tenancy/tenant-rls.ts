import { Logger } from '@nestjs/common';
import { PostgresQueryRunner } from 'typeorm/driver/postgres/PostgresQueryRunner';
import { TenantContext } from './tenant-context';

/**
 * Conecta el TenantContext (Node) con Row Level Security (PostgreSQL).
 *
 * Antes de cada consulta, si la conexión del pool tiene otra empresa fijada,
 * ejecuta `set_config('app.tenant_id', <empresa>, false)` en esa misma conexión.
 * Se recuerda el valor por conexión para no repetir la llamada en cada consulta.
 */
let installed = false;
const TENANT_KEY = Symbol('fashionstore.tenant');

export function installTenantRls() {
  if (installed) return;
  installed = true;
  const proto = PostgresQueryRunner.prototype as any;

  for (const method of ['query', 'stream'] as const) {
    const original = proto[method];
    proto[method] = async function (this: any, ...args: any[]) {
      const desired = TenantContext.databaseSetting(); // se lee en el contexto de la petición
      const connection = await this.connect();
      if (connection[TENANT_KEY] !== desired) {
        await connection.query(
          `SELECT set_config('app.tenant_id', $1, false)`,
          [desired],
        );
        connection[TENANT_KEY] = desired;
      }
      return original.apply(this, args);
    };
  }
  new Logger('TenantRls').log(
    'Aislamiento por empresa en BD (RLS) conectado al contexto de la petición',
  );
}
