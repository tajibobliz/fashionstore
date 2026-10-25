import { jest } from '@jest/globals';
import { lastValueFrom, of, defer } from 'rxjs';
import { TenantContextInterceptor } from './tenant-context.interceptor';
import { TenantContext } from './tenant-context';
import { TenantResolverService } from './tenant-resolver.service';

/** Ejecuta el interceptor y devuelve el tenant que "vio" el handler. */
async function tenantSeenByHandler(
  interceptor: TenantContextInterceptor,
  req: any,
) {
  const ctx: any = {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => req }),
  };
  const next = {
    handle: () => defer(() => of(TenantContext.currentTenantId())),
  };
  return lastValueFrom(await interceptor.intercept(ctx, next));
}

describe('TenantContextInterceptor', () => {
  const resolver = {
    findBySlug: jest.fn(async (slug: string) =>
      slug === 'bella-moda'
        ? { idEmpresa: 2, estado: 'ACTIVA' }
        : slug === 'cerrada'
          ? { idEmpresa: 3, estado: 'SUSPENDIDA' }
          : null,
    ),
  };
  const interceptor = new TenantContextInterceptor(
    resolver as unknown as TenantResolverService,
  );

  it('uses the company of the authenticated user', async () => {
    expect(
      await tenantSeenByHandler(interceptor, {
        user: { idEmpresa: 1 },
        headers: {},
      }),
    ).toBe(1);
  });
  it('ignores X-Tenant when the user is authenticated (no switching companies)', async () => {
    expect(
      await tenantSeenByHandler(interceptor, {
        user: { idEmpresa: 1 },
        headers: { 'x-tenant': 'bella-moda' },
      }),
    ).toBe(1);
  });
  it('resolves public requests by the X-Tenant slug', async () => {
    expect(
      await tenantSeenByHandler(interceptor, {
        headers: { 'x-tenant': 'bella-moda' },
      }),
    ).toBe(2);
  });
  it('leaves no tenant when nothing identifies one (default company applies later)', async () => {
    expect(await tenantSeenByHandler(interceptor, { headers: {} })).toBeNull();
  });
  it('rejects unknown or suspended companies', async () => {
    await expect(
      tenantSeenByHandler(interceptor, {
        headers: { 'x-tenant': 'no-existe' },
      }),
    ).rejects.toThrow('Tienda no encontrada');
    await expect(
      tenantSeenByHandler(interceptor, { headers: { 'x-tenant': 'cerrada' } }),
    ).rejects.toThrow('Tienda no encontrada');
  });
});
