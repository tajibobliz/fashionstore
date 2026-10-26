import { useQuery } from '@tanstack/react-query'
import { tenantApi } from '../../api/tenant.api'
import { useAuth } from '../../hooks/useAuth'

export const PLAN_QUERY_KEY = ['tenant', 'me'] as const
const ROLES_CON_PLAN = new Set(['ADMIN', 'ENCARGADO', 'ENCARGADO_SUCURSAL', 'CAJERO'])

/** Plan, vigencia y uso de la empresa del usuario (solo personal de una empresa). */
export function usePlan() {
  const { user, isAuthenticated } = useAuth()
  return useQuery({
    queryKey: PLAN_QUERY_KEY,
    queryFn: tenantApi.me,
    enabled: isAuthenticated && !!user && ROLES_CON_PLAN.has(user.rol),
    staleTime: 60_000,
  })
}
