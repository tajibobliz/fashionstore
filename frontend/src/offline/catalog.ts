import { useLiveQuery } from 'dexie-react-hooks'
import { syncApi } from '../api/sync.api'
import { offlineDb } from './db'
import type { CatalogoLocal } from './db'

const clave = (idEmpresa: number, idSucursal: number) => `${idEmpresa}:${idSucursal}`

/** Descarga el catálogo de una sucursal y lo guarda en el navegador (reemplaza el anterior). */
export async function descargarCatalogo(idEmpresa: number, idSucursal: number) {
  const data = await syncApi.catalogo(idSucursal)
  const registro: CatalogoLocal = { ...data, clave: clave(idEmpresa, idSucursal), idEmpresa, guardadoEn: new Date().toISOString() }
  await offlineDb.catalogos.put(registro)
  return registro
}

/** Catálogo guardado de una sucursal; se actualiza solo cuando cambia en IndexedDB. */
export function useCatalogoLocal(idEmpresa: number | null | undefined, idSucursal: number | null | undefined) {
  return useLiveQuery(
    () => (idEmpresa && idSucursal ? offlineDb.catalogos.get(clave(idEmpresa, idSucursal)) : undefined),
    [idEmpresa, idSucursal],
  )
}

/** Todos los catálogos guardados de una empresa (la clienta puede reservar en cualquier sucursal). */
export function useCatalogosEmpresa(idEmpresa: number | null | undefined) {
  return useLiveQuery(
    async (): Promise<CatalogoLocal[] | undefined> =>
      (idEmpresa ? offlineDb.catalogos.where('idEmpresa').equals(idEmpresa).toArray() : undefined),
    [idEmpresa],
  )
}

/**
 * Descuenta en el catálogo local lo vendido o reservado sin conexión, para no volver a
 * ofrecer prendas que ya salieron. El servidor tiene la última palabra al sincronizar.
 */
export async function descontarStockLocal(idEmpresa: number, idSucursal: number, items: { idVariante: number; cantidad: number }[]) {
  await offlineDb.transaction('rw', offlineDb.catalogos, async () => {
    const catalogo = await offlineDb.catalogos.get(clave(idEmpresa, idSucursal))
    if (!catalogo) return
    for (const p of catalogo.productos) {
      for (const v of p.variantes) {
        const item = items.find(i => i.idVariante === v.idVariante)
        if (item) v.stockDisponible = Math.max(0, v.stockDisponible - item.cantidad)
      }
    }
    await offlineDb.catalogos.put(catalogo)
  })
}
