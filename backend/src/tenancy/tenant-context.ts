import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Contexto del tenant por request.
 * AsyncLocalStorage guarda un valor que "viaja" con cada petición HTTP a través
 * de todas las llamadas async, sin tener que pasarlo como parámetro.
 * Lo llena `TenantContextInterceptor` a partir del JWT (`tid`) o del header `X-Tenant`.
 */
export interface TenantStore {
  /** Empresa de la petición. */
  idEmpresa: number | null;
  /** true = sin filtro por empresa (SUPER_ADMIN / tareas de plataforma). */
  bypass?: boolean;
}

const storage = new AsyncLocalStorage<TenantStore>();

export const TenantContext = {
  run<T>(store: TenantStore, fn: () => T): T {
    return storage.run(store, fn);
  },
  /** Ejecuta `fn` sin filtro por empresa (usar solo en código de plataforma o auth). */
  runAsPlatform<T>(fn: () => T): T {
    return storage.run({ idEmpresa: null, bypass: true }, fn);
  },
  currentTenantId(): number | null {
    return storage.getStore()?.idEmpresa ?? null;
  },
  /**
   * Valor para la variable de sesión `app.tenant_id` de PostgreSQL:
   * id de la empresa, o '' (sin filtro) fuera de una petición o en modo plataforma.
   */
  databaseSetting(): string {
    const store = storage.getStore();
    if (!store || store.bypass || store.idEmpresa == null) return '';
    return String(store.idEmpresa);
  },
};

/** Slug de la empresa que recibió los datos existentes al migrar (compatibilidad). */
export const DEFAULT_TENANT_SLUG = 'fashionstore';
