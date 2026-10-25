import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Contexto del tenant por request.
 * AsyncLocalStorage guarda un valor que "viaja" con cada petición HTTP a través
 * de todas las llamadas async, sin tener que pasarlo como parámetro.
 * Se llenará desde el JWT (`tid`) en el paso 4 de la Fase 1.
 */
export interface TenantStore {
  idEmpresa: number | null;
}

const storage = new AsyncLocalStorage<TenantStore>();

export const TenantContext = {
  run<T>(store: TenantStore, fn: () => T): T {
    return storage.run(store, fn);
  },
  currentTenantId(): number | null {
    return storage.getStore()?.idEmpresa ?? null;
  },
};

/** Slug de la empresa que recibió los datos existentes al migrar (compatibilidad). */
export const DEFAULT_TENANT_SLUG = 'fashionstore';
