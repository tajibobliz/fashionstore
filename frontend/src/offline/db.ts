import Dexie from 'dexie'
import type { Table } from 'dexie'
import type { Alternativa, CatalogoSync, OperacionEnviada, TipoConflicto } from '../api/sync.api'

/**
 * Base de datos del navegador (IndexedDB) para trabajar sin conexión. Dexie es una
 * librería que simplifica IndexedDB: tablas, índices y consultas con promesas.
 *
 * Todo se guarda separado por empresa y usuario, porque el mismo navegador puede usarse
 * con cuentas de distintas empresas.
 */

/** Catálogo descargado de una sucursal ("foto" de productos, precios y stock). */
export interface CatalogoLocal extends CatalogoSync {
  /** `${idEmpresa}:${idSucursal}` */
  clave: string
  idEmpresa: number
  guardadoEn: string
}

/**
 * Estados de una operación en el dispositivo:
 * PENDIENTE → ENVIANDO → CONFIRMADA | RECHAZADA | CONFLICTO (y vuelve a PENDIENTE si falla la red).
 */
export type EstadoLocal = 'PENDIENTE' | 'ENVIANDO' | 'CONFIRMADA' | 'RECHAZADA' | 'CONFLICTO'

export interface OperacionLocal extends OperacionEnviada {
  idEmpresa: number
  idUsuario: number
  estado: EstadoLocal
  /** Texto para mostrar en la lista ("Venta · 2 prendas · Bs 340"). */
  resumen: string
  intentos: number
  ultimoError?: string
  serverId?: number | null
  conflictos?: TipoConflicto[]
  motivo?: string | null
  alternativas?: Alternativa[]
  sincronizadaEn?: string
}

class OfflineDb extends Dexie {
  catalogos!: Table<CatalogoLocal, string>
  operaciones!: Table<OperacionLocal, string>

  constructor() {
    super('fashionstore-offline')
    this.version(1).stores({
      catalogos: '&clave, idEmpresa',
      operaciones: '&operationId, [idEmpresa+idUsuario], estado, createdAtLocal',
    })
  }
}

export const offlineDb = new OfflineDb()

/** Identificador estable de este navegador (se envía en cada sincronización). */
export function deviceId() {
  const key = 'fashionstore.device_id'
  try {
    let id = localStorage.getItem(key)
    if (!id) {
      id = `web-${crypto.randomUUID()}`
      localStorage.setItem(key, id)
    }
    return id
  } catch {
    return 'web-sin-almacenamiento'
  }
}
