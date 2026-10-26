import { useLiveQuery } from 'dexie-react-hooks'
import { offlineDb } from './db'
import type { OperacionLocal } from './db'
import type { PayloadOperacion, TipoOperacion } from '../api/sync.api'
import { sincronizarPronto } from './sync'

interface NuevaOperacion {
  type: TipoOperacion
  idEmpresa: number
  idUsuario: number
  idSucursal: number
  payload: PayloadOperacion
  resumen: string
}

/**
 * Guarda una venta o reserva hecha sin conexión. El `operationId` (UUID) se crea aquí,
 * una sola vez: es la llave de idempotencia que el servidor usa para no duplicarla.
 */
export async function encolar(op: NuevaOperacion) {
  const registro: OperacionLocal = {
    ...op,
    operationId: crypto.randomUUID(),
    createdAtLocal: new Date().toISOString(),
    estado: 'PENDIENTE',
    intentos: 0,
  }
  await offlineDb.operaciones.add(registro)
  sincronizarPronto()
  return registro
}

/** Operaciones del usuario actual, de la más nueva a la más vieja. */
export function useOperacionesPropias(idEmpresa: number | null | undefined, idUsuario: number | null | undefined) {
  return useLiveQuery(
    async () => {
      if (!idEmpresa || !idUsuario) return [] as OperacionLocal[]
      const filas = await offlineDb.operaciones.where('[idEmpresa+idUsuario]').equals([idEmpresa, idUsuario]).toArray()
      return filas.sort((a, b) => b.createdAtLocal.localeCompare(a.createdAtLocal))
    },
    [idEmpresa, idUsuario],
    [] as OperacionLocal[],
  )
}

/** Quita de la lista local una operación ya resuelta por el servidor (no borra nada en el servidor). */
export async function descartar(operationId: string) {
  const op = await offlineDb.operaciones.get(operationId)
  if (op && op.estado !== 'PENDIENTE' && op.estado !== 'ENVIANDO') await offlineDb.operaciones.delete(operationId)
}

/** Limpia de la lista las operaciones confirmadas (siguen registradas en el servidor). */
export async function limpiarConfirmadas(idEmpresa: number, idUsuario: number) {
  const filas = await offlineDb.operaciones.where('[idEmpresa+idUsuario]').equals([idEmpresa, idUsuario]).toArray()
  await offlineDb.operaciones.bulkDelete(filas.filter(f => f.estado === 'CONFIRMADA').map(f => f.operationId))
}
