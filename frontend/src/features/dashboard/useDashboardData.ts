import { useEffect, useState } from 'react'
import { api } from '../../api/axios'
import { getApiErrorMessage } from '../../utils/apiError'
import type { DashboardRole } from './config'

export type Row = Record<string, unknown>
export const resourceUrls = { catalogo: '/catalog/productos', sucursales: '/branches/sucursales', inventario: '/inventory/inventarios', usuarios: '/users', proveedores: '/catalog/proveedores' } as const
export type Resource = keyof typeof resourceUrls
export function read(row: Row, path: string): string {
 let value: unknown = row
 for (const key of path.split('.')) {
  if (typeof value !== 'object' || value === null) return '—'
  value = (value as Row)[key]
 }
 return value == null ? '—' : String(value)
}
export function useDashboardData(role: DashboardRole, section: string) {
 const [reload, setReload] = useState(0)
 const key = `${role}/${section}/${reload}`
 const [result, setResult] = useState<{ key: string; data: Partial<Record<Resource, Row[]>>; errors: Partial<Record<Resource, string>> }>({ key: '', data: {}, errors: {} })
 useEffect(() => {
  const controller = new AbortController()
  const resources: Resource[] = role === 'ENCARGADO_SUCURSAL' ? [] : section in resourceUrls ? [section as Resource] : section ? [] : role === 'ADMIN' ? ['catalogo', 'sucursales', 'inventario', 'usuarios'] : ['catalogo', 'inventario']
  void Promise.allSettled(resources.map(resource => api.get<Row[]>(resourceUrls[resource], { signal: controller.signal }))).then(responses => {
   if (controller.signal.aborted) return
   const data: Partial<Record<Resource, Row[]>> = {}
   const errors: Partial<Record<Resource, string>> = {}
   responses.forEach((response, index) => {
    const resource = resources[index]
    if (response.status === 'fulfilled' && Array.isArray(response.value.data)) data[resource] = response.value.data
    else errors[resource] = response.status === 'rejected' ? getApiErrorMessage(response.reason) : 'La información recibida no es válida.'
   })
   setResult({ key, data, errors })
  })
  return () => controller.abort()
 }, [role, section, key])
 return { data: result.key === key ? result.data : {}, errors: result.key === key ? result.errors : {}, loading: result.key !== key, reload: () => setReload(value => value + 1) }
}
