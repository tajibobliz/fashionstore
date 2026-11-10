import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  NotFoundException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContext, TenantStore } from './tenant-context';
import { TenantResolverService } from './tenant-resolver.service';
import { Role } from '../auth/enums/role.enum';

/** Header con el slug de la empresa, para endpoints públicos (tienda online). */
export const TENANT_HEADER = 'x-tenant';

/**
 * Interceptor global: decide la empresa de cada petición y la guarda en TenantContext.
 * Desde ahí la usan el subscriber (al insertar) y RLS en PostgreSQL (al consultar).
 *
 * Prioridad:
 * 1. Usuario autenticado → la empresa de su token (`tid`). El header se ignora,
 *    así nadie puede "cambiarse" de empresa enviando otro slug.
 *    SUPER_ADMIN → modo plataforma (sin filtro).
 * 2. Petición pública con header `X-Tenant: <slug>` → esa empresa.
 * 3. Nada → empresa por defecto (compatibilidad con la web y la app actuales).
 *
 * Los guards (JWT) se ejecutan antes que los interceptores, por eso `req.user` ya existe.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly resolver: TenantResolverService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest();
    const store = await this.resolveTenant(req);

    // El Observable se suscribe después; por eso el run() envuelve la suscripción.
    return new Observable((subscriber) =>
      TenantContext.run(store, () => next.handle().subscribe(subscriber)),
    );
  }

  private async resolveTenant(req: any): Promise<TenantStore> {
    if (req.user) {
      if (req.user.rol === Role.SUPER_ADMIN)
        return { idEmpresa: null, bypass: true };
      return {
        idEmpresa:
          req.user.idEmpresa ?? (await this.resolver.defaultTenantId()),
      };
    }
    const raw = req.headers?.[TENANT_HEADER];
    const slug = Array.isArray(raw) ? raw[0] : raw;
    if (!slug) return { idEmpresa: await this.resolver.defaultTenantId() };
    const empresa = await this.resolver.findBySlug(String(slug));
    if (!empresa || empresa.estado !== 'ACTIVA')
      throw new NotFoundException('Tienda no encontrada');
    return { idEmpresa: empresa.idEmpresa };
  }
}
