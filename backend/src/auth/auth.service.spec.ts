import { AuthService } from './auth.service';
import { jest } from '@jest/globals';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { RefreshSession } from './entities/refresh-session.entity';
import { createHash } from 'node:crypto';
import { TenantResolverService } from '../tenancy/tenant-resolver.service';

describe('Refresh sessions', () => {
  const user = {
    idUsuario: 1,
    estado: true,
    email: 'test@example.com',
    rol: { nombre: 'CLIENTE' },
  };
  let service: AuthService;
  let repo: any;
  let users: any;
  let tenants: any;
  let sign: any;
  beforeEach(() => {
    repo = {
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => v),
      findOne: jest.fn(),
      delete: jest.fn(async () => ({})),
    };
    repo.manager = {
      transaction: async (callback: any) =>
        callback({ getRepository: () => repo }),
    };
    users = { findById: jest.fn(async () => user) };
    tenants = {
      defaultTenantId: jest.fn(async () => 1),
      currentOrDefault: jest.fn(async () => 1),
      findBySlug: jest.fn(async (slug: string) =>
        slug === 'bella-moda' ? { idEmpresa: 2, slug, estado: 'ACTIVA' } : null,
      ),
    };
    sign = jest.fn(() => 'jwt');
    service = new AuthService(
      users as UsersService,
      { sign } as unknown as JwtService,
      repo as Repository<RefreshSession>,
      { get: () => undefined } as unknown as ConfigService,
      tenants as TenantResolverService,
    );
  });
  it('principal registration always creates CLIENTE', async () => {
    users.create = jest.fn(async () => user);
    const result = await service.register({
      nombre: 'Ana',
      email: user.email,
      password: 'secret123',
      rolNombre: 'ADMIN',
    } as any);
    expect(users.create).toHaveBeenCalledWith({
      idEmpresa: 1,
      nombre: 'Ana',
      email: user.email,
      password: 'secret123',
      apellido: undefined,
      telefono: undefined,
      rolNombre: 'CLIENTE',
    });
    expect(result.user.rol).toBe('CLIENTE');
    expect(result.refresh_token).toMatch(/^[a-f0-9]{96}$/);
  });
  it('stores only a hash of the random token', async () => {
    const result = await service.login(user);
    expect(result.refresh_token).toMatch(/^[a-f0-9]{96}$/);
    expect(repo.save.mock.calls[0][0].tokenHash).toBe(
      createHash('sha256').update(result.refresh_token).digest('hex'),
    );
  });
  it('rotates a valid token under a lock without extending expiry', async () => {
    const expiresAt = new Date(Date.now() + 60000);
    repo.findOne.mockResolvedValue({ userId: 1, expiresAt });
    const result = await service.refresh('a'.repeat(96));
    expect(result.refresh_token).not.toBe('a'.repeat(96));
    expect(repo.findOne.mock.calls[0][0].lock.mode).toBe('pessimistic_write');
    expect(repo.save.mock.calls[0][0].expiresAt).toBe(expiresAt);
  });
  it('rejects unknown and previously rotated tokens', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.refresh('a'.repeat(96))).rejects.toThrow('inválido');
    expect(repo.save).not.toHaveBeenCalled();
  });
  it('rejects expired tokens', async () => {
    repo.findOne.mockResolvedValue({ userId: 1, expiresAt: new Date(0) });
    await expect(service.refresh('a'.repeat(96))).rejects.toThrow('expirado');
  });
  it('rejects inactive users', async () => {
    repo.findOne.mockResolvedValue({
      userId: 1,
      expiresAt: new Date(Date.now() + 60000),
    });
    users.findById.mockResolvedValue({ ...user, estado: false });
    await expect(service.refresh('a'.repeat(96))).rejects.toThrow(
      'Usuario inactivo',
    );
  });
  it('revokes the session on logout', async () => {
    await service.logout('b'.repeat(96));
    expect(repo.delete).toHaveBeenCalledWith({
      tokenHash: createHash('sha256').update('b'.repeat(96)).digest('hex'),
    });
  });

  describe('multitenant', () => {
    it('registers the client in the company given by its slug', async () => {
      users.create = jest.fn(async () => user);
      await service.register({
        nombre: 'Ana',
        email: user.email,
        password: 'secret123',
        empresa: 'bella-moda',
      } as any);
      expect((users.create as any).mock.calls[0][0].idEmpresa).toBe(2);
    });
    it('rejects registration in an unknown company', async () => {
      users.create = jest.fn(async () => user);
      await expect(
        service.register({
          nombre: 'Ana',
          email: user.email,
          password: 'secret123',
          empresa: 'no-existe',
        } as any),
      ).rejects.toThrow('Tienda no encontrada');
      expect(users.create).not.toHaveBeenCalled();
    });
    it('puts the tenant id (tid) in the access token', async () => {
      await service.login({ ...user, idEmpresa: 2 });
      expect(sign.mock.calls[0][0]).toMatchObject({ sub: 1, tid: 2 });
    });
    it('looks the user up inside the company of the slug', async () => {
      users.findByEmailWithPassword = jest.fn(async () => null);
      await service.validateUser(user.email, 'x', 'bella-moda');
      expect(users.findByEmailWithPassword).toHaveBeenCalledWith(user.email, 2);
    });
    it('without slug tries platform users first, then the default company', async () => {
      users.findByEmailWithPassword = jest.fn(async () => null);
      await service.validateUser(user.email, 'x');
      expect(
        (users.findByEmailWithPassword as any).mock.calls.map(
          (c: any[]) => c[1],
        ),
      ).toEqual([null, 1]);
    });
    it('blocks login when the company is suspended', async () => {
      const bcrypt = await import('bcrypt');
      const passwordHash = await bcrypt.hash('secret123', 4);
      users.findByEmailWithPassword = jest.fn(async () => ({
        ...user,
        passwordHash,
        empresa: { estado: 'SUSPENDIDA' },
      }));
      await expect(
        service.validateUser(user.email, 'secret123', 'bella-moda'),
      ).rejects.toThrow('suspendida');
    });
  });
});
