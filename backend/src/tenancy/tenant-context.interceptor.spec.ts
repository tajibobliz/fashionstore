import { jest } from '@jest/globals';
import { defer, lastValueFrom, of } from 'rxjs';
import { TenantContextInterceptor } from './tenant-context.interceptor';
import { TenantContext } from './tenant-context';
import { TenantResolverService } from './tenant-resolver.service';

/** Ejecuta el interceptor y devuelve el valor de `app.tenant_id` que vería la BD en el handler. */
async function tenantSeenByHandler(interceptor: TenantContextInterceptor, req: any) {
  const ctx: any = { getType: () => 'http', switchToHttp: () => ({ getRequest: () => req }) };
  const next = { handle: () => defer(() => of(TenantContext.databaseSetting())) };
  return lastValueFrom(await interceptor.intercept(ctx, next));
}

describe('TenantContextInterceptor', () => {
  const resolver = {
    defaultTenantId: jest.fn(async () => 1),
    findBySlug: jest.fn(async (slug: string) =>
      slug === 'bella-moda'
        ? { idEmpresa: 2, estado: 'ACTIVA' }
        : slug === 'cerrada'
          ? { idEmpresa: 3, estado: 'SUSPENDIDA' }
          : null,
    ),
  };
  const interceptor = new TenantContextInterceptor(resolver as unknown as TenantResolverService);

  it('uses the company of the authenticated user', async () => {
    expect(await tenantSeenByHandler(interceptor, { user: { idEmpresa: 4 }, headers: {} })).toBe('4');
  });
  it('ignores X-Tenant when the user is authenticated (no switching companies)', async () => {
    const req = { user: { idEmpresa: 4 }, headers: { 'x-tenant': 'bella-moda' } };
    expect(await tenantSeenByHandler(interceptor, req)).toBe('4');
  });
  it('resolves public requests by the X-Tenant slug', async () => {
    expect(await tenantSeenByHandler(interceptor, { headers: { 'x-tenant': 'bella-moda' } })).toBe('2');
  });
  it('uses the default company when nothing identifies one (compatibility)', async () => {
    expect(await tenantSeenByHandler(interceptor, { headers: {} })).toBe('1');
  });
  it('runs SUPER_ADMIN requests without company filter', async () => {
    const req = { user: { rol: 'SUPER_ADMIN', idEmpresa: null }, headers: {} };
    expect(await tenantSeenByHandler(interceptor, req)).toBe('');
  });
  it('rejects unknown or suspended companies', async () => {
    await expect(tenantSeenByHandler(interceptor, { headers: { 'x-tenant': 'no-existe' } })).rejects.toThrow(
      'Tienda no encontrada',
    );
    await expect(tenantSeenByHandler(interceptor, { headers: { 'x-tenant': 'cerrada' } })).rejects.toThrow(
      'Tienda no encontrada',
    );
  });
});
