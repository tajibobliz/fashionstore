import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { kpisApi } from '../../api/kpis.api'
import type { Kpis } from '../../api/kpis.api'
import { useAuth } from '../../hooks/useAuth'

/** El CU12 pide refrescar cada 5 minutos si hay conexión. */
export const REFRESCO_MS = 5 * 60_000

/**
 * KPIs con caché local: la última respuesta se guarda en localStorage (por usuario y filtros).
 * Sin conexión se muestra esa copia con el banner "Datos actualizados al [hora]" (CU12).
 */
export function useKpis(idSucursal: number | undefined, dias: number) {
  const { user } = useAuth()
  const clave = `fashionstore.kpis.${user?.idEmpresa ?? 0}.${user?.idUsuario ?? 0}.${idSucursal ?? 'todas'}.${dias}`
  const query = useQuery({
    queryKey: ['kpis', user?.idEmpresa, idSucursal ?? null, dias],
    queryFn: () => kpisApi.obtener({ idSucursal, dias }),
    refetchInterval: () => (navigator.onLine ? REFRESCO_MS : false),
    refetchOnWindowFocus: true,
    retry: (n) => navigator.onLine && n < 1,
    enabled: !!user,
  })

  useEffect(() => {
    if (!query.data) return
    try { localStorage.setItem(clave, JSON.stringify(query.data)) } catch { /* sin espacio o bloqueado */ }
  }, [query.data, clave])

  let guardado: Kpis | null = null
  if (!query.data) {
    try { const t = localStorage.getItem(clave); guardado = t ? (JSON.parse(t) as Kpis) : null } catch { guardado = null }
  }
  return {
    datos: query.data ?? guardado,
    desdeCache: !query.data && !!guardado,
    cargando: query.isLoading && !guardado,
    error: query.error,
    actualizando: query.isFetching,
    actualizadoEn: query.dataUpdatedAt,
    refrescar: () => void query.refetch(),
  }
}
