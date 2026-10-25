import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Buscar si el método o el controlador tienen el marcador @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(), // el método (ej: findAllProductos)
      context.getClass(), // el controlador entero (ej: CatalogController)
    ]);

    if (isPublic) {
      // Público, pero si llega un token válido se identifica al usuario igual:
      // así un empleado de la Empresa B ve el catálogo de B y no el de la empresa por defecto.
      const req = context.switchToHttp().getRequest();
      if (!req.headers?.authorization) return true;
      try {
        await super.canActivate(context);
      } catch {
        // Token inválido o vencido en un endpoint público: se atiende como anónimo.
      }
      return true;
    }

    // Si no, aplicar la validación JWT normal
    return (await super.canActivate(context)) as boolean;
  }
}
