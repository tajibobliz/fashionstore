import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Buscar si el método o el controlador tienen el marcador @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(), // el método (ej: findAllProductos)
      context.getClass(),   // el controlador entero (ej: CatalogController)
    ]);

    // Si es público, permitir sin validar token
    if (isPublic) return true;

    // Si no, aplicar la validación JWT normal
    return super.canActivate(context);
  }
}