import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  NotFoundException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContext } from './tenant-context';
import { TenantResolverService } from './tenant-resolver.service';

/** Header con el slug de la empresa, para endpoints públicos (tienda online). */
export const TENANT_HEADER = 'x-tenant';

/**
 * Interceptor global: decide la empresa de cada petición y la guarda en TenantContext.
 *
 * Prioridad:
 * 1. Usuario autenticado → la empresa de su token (`tid`). El header se ignora,
 *    así nadie puede "cambiarse" de empresa enviando otro slug.
 * 2. Petición pública con header `X-Tenant: <slug>` → esa empresa.
 * 3. Nada → sin tenant en el contexto (se usará la empresa por defecto).
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
    const idEmpresa = await this.resolveTenant(req);

    // El Observable se suscribe después; por eso el run() envuelve la suscripción.
    return new Observable((subscriber) =>
      TenantContext.run({ idEmpresa }, () =>
        next.handle().subscribe(subscriber),
      ),
    );
  }

  private async resolveTenant(req: any): Promise<number | null> {
    if (req.user) return req.user.idEmpresa ?? null;
    const raw = req.headers?.[TENANT_HEADER];
    const slug = Array.isArray(raw) ? raw[0] : raw;
    if (!slug) return null;
    const empresa = await this.resolver.findBySlug(String(slug));
    if (!empresa || empresa.estado !== 'ACTIVA')
      throw new NotFoundException('Tienda no encontrada');
    return empresa.idEmpresa;
  }
}
