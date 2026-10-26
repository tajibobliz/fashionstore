import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { branchesApi } from '../../api/branches.api'
import { queryKeys } from '../../api/queryKeys'
import { descargarCatalogo } from '../../offline/catalog'

/** Momento de la última descarga por empresa: evita descargar en cada render o navegación. */
const ultimaDescarga = new Map<number, number>()
const CADA_MS = 10 * 60_000

/**
 * Con internet y sesión de clienta, guarda el catálogo de cada sucursal activa para que
 * la tienda siga funcionando (y se pueda reservar) si se corta la conexión.
 */
export function usePrepararTiendaOffline(idEmpresa: number | null | undefined, activo: boolean) {
  const branches = useQuery({ queryKey: queryKeys.branches.all, queryFn: branchesApi.branches.list, enabled: activo && !!idEmpresa })
  useEffect(() => {
    if (!activo || !idEmpresa || !branches.data) return
    const ultima = ultimaDescarga.get(idEmpresa) ?? 0
    if (Date.now() - ultima < CADA_MS) return
    ultimaDescarga.set(idEmpresa, Date.now())
    for (const s of branches.data.filter(b => b.estado !== false)) {
      descargarCatalogo(idEmpresa, s.idSucursal).catch(() => { /* se reintenta en la próxima visita */ })
    }
  }, [activo, idEmpresa, branches.data])
}
