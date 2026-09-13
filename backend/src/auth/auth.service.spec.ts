import { AuthService } from './auth.service';
import { jest } from '@jest/globals';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { RefreshSession } from './entities/refresh-session.entity';
import { createHash } from 'node:crypto';

describe('Refresh sessions', () => {
  const user = { idUsuario: 1, estado: true, email: 'test@example.com', rol: { nombre: 'CLIENTE' } };
  let service: AuthService;
  let repo: any;
  let users: any;
  beforeEach(() => {
    repo = { create: jest.fn(v => v), save: jest.fn(async v => v), findOne: jest.fn(), delete: jest.fn(async () => ({})) };
    repo.manager = { transaction: async (callback: any) => callback({ getRepository: () => repo }) };
    users = { findById: jest.fn(async () => user) };
    service = new AuthService(users as UsersService, { sign: () => 'jwt' } as unknown as JwtService,
      repo as Repository<RefreshSession>, { get: () => undefined } as unknown as ConfigService);
  });
  it('stores only a hash of the random token', async () => {
    const result = await service.login(user);
    expect(result.refresh_token).toMatch(/^[a-f0-9]{96}$/);
    expect(repo.save.mock.calls[0][0].tokenHash).toBe(createHash('sha256').update(result.refresh_token).digest('hex'));
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
    repo.findOne.mockResolvedValue({ userId: 1, expiresAt: new Date(Date.now() + 60000) });
    users.findById.mockResolvedValue({ ...user, estado: false });
    await expect(service.refresh('a'.repeat(96))).rejects.toThrow('Usuario inactivo');
  });
  it('revokes the session on logout', async () => {
    await service.logout('b'.repeat(96));
    expect(repo.delete).toHaveBeenCalledWith({ tokenHash: createHash('sha256').update('b'.repeat(96)).digest('hex') });
  });
});
