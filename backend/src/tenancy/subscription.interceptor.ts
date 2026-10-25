import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { TenantContext } from './tenant-context';
import { PlanService } from './plan.service';
import {
  ALLOW_WITHOUT_SUBSCRIPTION_KEY,
  REQUIRES_FEATURE_KEY,
} from './plan.decorators';
import type { PlanFeatures } from './entities/plan.entity';

const ESCRITURA = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Aplica la suscripción en el backend (no solo ocultando botones en la web):
 * - `@RequiresFeature('aiReports')` → solo si el plan lo incluye.
 * - Operaciones de escritura → solo con suscripción vigente y empresa activa.
 *   Las consultas (GET) siguen permitidas para que la empresa vea sus datos y renueve.
 * Se ejecuta después de TenantContextInterceptor (ya sabe la empresa).
 */
@Injectable()
export class SubscriptionInterceptor implements NestInterceptor {
  constructor(
    private readonly plans: PlanService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    if (context.getType() !== 'http') return next.handle();
    const setting = TenantContext.databaseSetting();
    if (!setting) return next.handle(); // SUPER_ADMIN / sin empresa
    const idEmpresa = Number(setting);
    const targets = [context.getHandler(), context.getClass()];

    const feature = this.reflector.getAllAndOverride<keyof PlanFeatures>(
      REQUIRES_FEATURE_KEY,
      targets,
    );
    if (feature) await this.plans.asegurarFuncionalidad(idEmpresa, feature);

    const method = context.switchToHttp().getRequest().method;
    const permitido = this.reflector.getAllAndOverride<boolean>(
      ALLOW_WITHOUT_SUBSCRIPTION_KEY,
      targets,
    );
    if (ESCRITURA.has(method) && !permitido)
      await this.plans.asegurarVigente(idEmpresa);

    return next.handle();
  }
}
