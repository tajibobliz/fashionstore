import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../enums/role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Lee los roles requeridos del decorador @Roles(...)
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si el endpoint no tiene @Roles(), deja pasar (útil cuando solo se quiere JWT)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Obtiene el usuario del request (lo puso JwtStrategy)
    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.rol) {
      throw new ForbiddenException('Usuario sin rol asignado');
    }

    // Verifica si el rol del usuario está en la lista de permitidos
    const tienePermiso = requiredRoles.some((rol) => rol === user.rol);

    if (!tienePermiso) {
      throw new ForbiddenException(
        `Se requiere uno de estos roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}