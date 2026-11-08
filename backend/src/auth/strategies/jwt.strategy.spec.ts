import { jest } from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { JwtStrategy } from './jwt.strategy';
import { TenantResolverService } from '../../tenancy/tenant-resolver.service';
import { olvidarEstado } from '../../users/usuarios-activos';

describe('JwtStrategy (multitenant)', () => {
  const tenants = { defaultTenantId: jest.fn(async () => 1) };
  /** Usuarios en la base falsa: id → activo. */
  const activos = new Map<number, boolean>([
    [5, true],
    [9, true],
    [7, false],
  ]);
  const findOne = jest.fn(async (o: any) => {
    const id = o.where.idUsuario as number;
    return activos.has(id) ? { idUsuario: id, estado: activos.get(id) } : null;
  });
  const dataSource = { getRepository: () => ({ findOne }) };
  const strategy = new JwtStrategy(
    { get: () => 'secret' } as unknown as ConfigService,
    tenants as unknown as TenantResolverService,
    dataSource as unknown as DataSource,
  );
  beforeEach(() => [5, 7, 9, 99].forEach(olvidarEstado));

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
  it('rejects tokens of deactivated or deleted users', async () => {
    await expect(
      strategy.validate({ sub: 7, rol: 'CAJERO', tid: 2 }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      strategy.validate({ sub: 99, rol: 'CAJERO', tid: 2 }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('caches the status for a short time (one query for repeated requests)', async () => {
    findOne.mockClear();
    await strategy.validate({ sub: 5, rol: 'CAJERO', tid: 2 });
    await strategy.validate({ sub: 5, rol: 'CAJERO', tid: 2 });
    expect(findOne).toHaveBeenCalledTimes(1);
  });
});
