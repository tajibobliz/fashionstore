import { jest } from '@jest/globals';
import { UsersService } from './users.service';
import { Role } from '../auth/enums/role.enum';
import type { Usuario } from './entities/user.entity';

describe('Staff user registration permissions', () => {
  const service = new UsersService({} as never, {} as never);
  const create = jest.spyOn(service, 'create');
  beforeEach(() => create.mockReset());

  it.each([
    [Role.ENCARGADO, Role.CLIENTE], [Role.ENCARGADO, Role.PROVEEDOR], [Role.ENCARGADO, Role.CAJERO],
    [Role.CAJERO, Role.CLIENTE], [Role.CAJERO, Role.PROVEEDOR], [Role.ADMIN, Role.ENCARGADO],
  ])('%s can create %s without exposing password hashes', async (actor, role) => {
    create.mockResolvedValue({ idUsuario: 1, nombre: 'Ana', email: 'ana@example.com', passwordHash: 'private', rol: { nombre: role } } as Usuario);
    const result = await service.createByStaff({ nombre: 'Ana', email: 'ana@example.com', password: 'secret123', rolNombre: role }, actor);
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
});
