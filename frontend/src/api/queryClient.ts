import { QueryClient, hashKey } from '@tanstack/react-query'
import type { QueryKey } from '@tanstack/react-query'
import { authSession } from '../features/auth/session'
import { storeScope } from '../features/store/storeScope'

/**
 * La caché se separa por usuario y por tienda: así, al cambiar de cuenta o pasar de
 * /t/urban-step a /tienda, nunca se muestran por un instante datos de otra empresa.
 */
function tenantAwareHash(queryKey: QueryKey) {
  const userId = authSession.getSnapshot().user?.idUsuario ?? 0
  return hashKey([userId, storeScope.get() ?? '', ...queryKey])
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000, queryKeyHashFn: tenantAwareHash },
    mutations: { retry: 0 },
  },
})
