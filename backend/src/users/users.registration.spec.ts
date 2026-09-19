import { jest } from '@jest/globals';
import { UsersService } from './users.service';
import { Role } from '../auth/enums/role.enum';
import type { Usuario } from './entities/user.entity';

describe('Staff user registration permissions', () => {
  const assignments = { create: jest.fn((value) => value), save: jest.fn(async (value) => value) };
  const branches = { findByIds: jest.fn(async () => [{ idSucursal: 4, nombre: 'Centro', estado: true }]) };
  const service = new UsersService({} as never, {} as never, assignments as never, branches as never);
  const create = jest.spyOn(service, 'create');
  beforeEach(() => create.mockReset());

  it.each([
    [Role.ENCARGADO, Role.CLIENTE], [Role.ENCARGADO, Role.PROVEEDOR], [Role.ENCARGADO, Role.CAJERO],
    [Role.CAJERO, Role.CLIENTE], [Role.CAJERO, Role.PROVEEDOR], [Role.ADMIN, Role.ENCARGADO],
  ])('%s can create %s without exposing password hashes', async (actor, role) => {
    create.mockResolvedValue({ idUsuario: 1, nombre: 'Ana', email: 'ana@example.com', passwordHash: 'private', rol: { nombre: role } } as Usuario);
    const operational = role === Role.CAJERO || role === Role.ENCARGADO_SUCURSAL;
    const result = await service.createByStaff({ nombre: 'Ana', email: 'ana@example.com', password: 'secret123', rolNombre: role, ...(operational ? { idSucursales: [4] } : {}) }, actor);
    expect(result.rol).toBe(role);
    expect(result).not.toHaveProperty('passwordHash');
  });

  it.each([
    [Role.ENCARGADO, Role.ADMIN], [Role.ENCARGADO, Role.ENCARGADO], [Role.CAJERO, Role.ADMIN],
    [Role.CAJERO, Role.ENCARGADO], [Role.CAJERO, Role.CAJERO], [Role.CLIENTE, Role.CLIENTE], [Role.PROVEEDOR, Role.PROVEEDOR],
  ])('%s cannot create %s', async (actor, role) => {
    await expect(service.createByStaff({ nombre: 'Ana', email: 'ana@example.com', password: 'secret123', rolNombre: role }, actor)).rejects.toThrow('No tienes permiso');
    expect(create).not.toHaveBeenCalled();
  });

  it.each([Role.CAJERO, Role.ENCARGADO_SUCURSAL])('requires a branch when creating %s', async (role) => {
    await expect(service.createByStaff({ nombre: 'Ana', email: 'ana@example.com', password: 'secret123', rolNombre: role }, Role.ENCARGADO)).rejects.toThrow('Debes asignar al menos una sucursal');
    expect(create).not.toHaveBeenCalled();
  });
});
