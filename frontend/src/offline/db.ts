import Dexie from 'dexie'
import type { Table } from 'dexie'
import type { Alternativa, CatalogoSync, OperacionEnviada, TipoConflicto } from '../api/sync.api'
import type { AuthUser } from '../features/auth/types'

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
  /** Texto para mostrar en la lista ("Venta · 2 prendas · Bs 340", en la moneda de la tienda). */
  resumen: string
  intentos: number
  ultimoError?: string
  serverId?: number | null
  conflictos?: TipoConflicto[]
  motivo?: string | null
  alternativas?: Alternativa[]
  sincronizadaEn?: string
}

/**
 * Sesión offline con PIN (CU17) de un usuario en este navegador. Los tokens van cifrados con
 * AES-GCM y una clave que sale del PIN (PBKDF2); el PIN no se guarda en ningún lado.
 */
export interface SesionOfflineLocal {
  /** `${idEmpresa}:${idUsuario}` */
  clave: string
  idEmpresa: number
  idUsuario: number
  /** Datos para mostrar y para volver a entrar (sin secretos). */
  user: AuthUser
  salt: Uint8Array
  iv: Uint8Array
  cifrado: ArrayBuffer
  /** Plazo de la empresa (horas) para operar sin conexión. */
  horas: number
  /** Última vez que el usuario estuvo en línea con sesión válida (el plazo se cuenta desde aquí). */
  validadaEn: string
  intentosFallidos: number
  creadaEn: string
}

/** Prenda en el carrito offline (CU15). El precio es el del catálogo guardado: estimado. */
export interface ItemCarrito {
  idVariante: number
  nombre: string
  detalle: string
  precioUnitario: number
  cantidad: number
}

/** Carrito sin conexión de un usuario en una sucursal; sobrevive a cerrar el navegador. */
export interface CarritoLocal {
  /** `${idEmpresa}:${idUsuario}:${idSucursal}` */
  clave: string
  idEmpresa: number
  idUsuario: number
  idSucursal: number
  items: ItemCarrito[]
  actualizadoEn: string
}

class OfflineDb extends Dexie {
  catalogos!: Table<CatalogoLocal, string>
  operaciones!: Table<OperacionLocal, string>
  sesiones!: Table<SesionOfflineLocal, string>
  carritos!: Table<CarritoLocal, string>

  constructor() {
    super('fashionstore-offline')
    this.version(1).stores({
      catalogos: '&clave, idEmpresa',
      operaciones: '&operationId, [idEmpresa+idUsuario], estado, createdAtLocal',
    })
    // v2: sesiones offline con PIN (CU17). Dexie migra solo: agrega la tabla y conserva los datos.
    this.version(2).stores({
      catalogos: '&clave, idEmpresa',
      operaciones: '&operationId, [idEmpresa+idUsuario], estado, createdAtLocal',
      sesiones: '&clave, idEmpresa',
    })
    // v3: carrito offline (CU15).
    this.version(3).stores({
      catalogos: '&clave, idEmpresa',
      operaciones: '&operationId, [idEmpresa+idUsuario], estado, createdAtLocal',
      sesiones: '&clave, idEmpresa',
      carritos: '&clave, [idEmpresa+idUsuario]',
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
