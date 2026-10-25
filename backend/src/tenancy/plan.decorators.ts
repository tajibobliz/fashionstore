import { SetMetadata } from '@nestjs/common';
import type { PlanFeatures } from './entities/plan.entity';

export const REQUIRES_FEATURE_KEY = 'plan:requiresFeature';
export const ALLOW_WITHOUT_SUBSCRIPTION_KEY = 'plan:allowWithoutSubscription';

/** El endpoint solo funciona si el plan de la empresa incluye esa funcionalidad. */
export const RequiresFeature = (feature: keyof PlanFeatures) =>
  SetMetadata(REQUIRES_FEATURE_KEY, feature);

/** El endpoint de escritura sigue disponible aunque la suscripción esté vencida (p. ej. renovar). */
export const AllowWithoutSubscription = () =>
  SetMetadata(ALLOW_WITHOUT_SUBSCRIPTION_KEY, true);
