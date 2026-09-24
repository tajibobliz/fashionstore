import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Role } from '../auth/enums/role.enum';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';

describe('SalesController', () => {
  let controller: SalesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SalesController],
      providers: [SalesService],
    }).useMocker(() => ({})).compile();

    controller = module.get<SalesController>(SalesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /sales/from-cart authorization', () => {
    const handler = SalesController.prototype.createFromCart;
    const contextFor = (rol?: Role) => ({
      getHandler: () => handler,
      getClass: () => SalesController,
      switchToHttp: () => ({ getRequest: () => rol ? { user: { rol } } : {} }),
    }) as any;

    it('allows CLIENTE through the existing RolesGuard', () => {
      const guard = new RolesGuard(new Reflector());
      expect(guard.canActivate(contextFor(Role.CLIENTE))).toBe(true);
    });

    it.each([Role.CAJERO, Role.ENCARGADO_SUCURSAL, Role.ENCARGADO, Role.ADMIN])(
      'rejects %s with 403',
      (rol) => {
        const guard = new RolesGuard(new Reflector());
        expect(() => guard.canActivate(contextFor(rol))).toThrow(ForbiddenException);
      },
    );

    it('keeps JwtAuthGuard ahead of RolesGuard, so unauthenticated requests are rejected by JWT with 401', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, SalesController) as unknown[];
      expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
    });

    it('declares CLIENTE as the only role allowed for the digital cart checkout', () => {
      expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([Role.CLIENTE]);
    });
  });
});
