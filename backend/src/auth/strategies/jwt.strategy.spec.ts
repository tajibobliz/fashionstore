import { jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { TenantResolverService } from '../../tenancy/tenant-resolver.service';

describe('JwtStrategy (multitenant)', () => {
  const tenants = { defaultTenantId: jest.fn(async () => 1) };
  const strategy = new JwtStrategy(
    { get: () => 'secret' } as unknown as ConfigService,
    tenants as unknown as TenantResolverService,
  );

  it('takes the company from the tid claim', async () => {
    expect(
      (await strategy.validate({ sub: 5, rol: 'CAJERO', tid: 2 })).idEmpresa,
    ).toBe(2);
  });
  it('maps tokens issued before the SaaS (no tid) to the default company', async () => {
    expect((await strategy.validate({ sub: 5, rol: 'CAJERO' })).idEmpresa).toBe(
      1,
    );
  });
  it('keeps platform users without company', async () => {
    expect(
      (await strategy.validate({ sub: 9, rol: 'SUPER_ADMIN', tid: null }))
        .idEmpresa,
    ).toBeNull();
  });
});
