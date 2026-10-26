import { api } from './axios'

/** Catálogo de una sucursal tal como lo devuelve GET /sync/catalog (para trabajar sin conexión). */
export interface CatalogoSync {
  serverTime: string
  sucursal: { idSucursal: number; nombre: string }
  productos: {
    idProducto: number
    nombre: string
    categoria: string | null
    imagenUrl: string | null
    precio: number
    precioFinal: number
    variantes: { idVariante: number; sku: string; talla: string | null; color: string | null; stockDisponible: number }[]
  }[]
}

export type TipoOperacion = 'VENTA' | 'RESERVA'
export type EstadoServidor = 'CONFIRMADA' | 'RECHAZADA' | 'CONFLICTO'
export type TipoConflicto = 'STOCK' | 'SIN_STOCK' | 'PRECIO' | 'TURNO_CERRADO'
export interface Alternativa { idSucursal: number; sucursal: string; idVariante: number; stock: number }

export interface PayloadOperacion {
  detalles: { idVariante: number; cantidad: number; precioUnitario?: number }[]
  idTurno?: number
  idCaja?: number
  idUsuario?: number
  modalidadComercial?: 'MINORISTA' | 'MAYORISTA'
  catalogoDescargadoEn?: string
  metodoPago?: string
  referenciaPago?: string
}

export interface OperacionEnviada {
  operationId: string
  type: TipoOperacion
  idSucursal: number
  createdAtLocal: string
  payload: PayloadOperacion
}

export interface ResultadoSync {
  operationId: string
  status: EstadoServidor
  serverId: number | null
  conflictos: TipoConflicto[]
  reason: string | null
  duplicada: boolean
  alternativas?: Alternativa[]
}

/** Fila del panel de sincronización del encargado. */
export interface OperacionPanel {
  idOperacionSync: number
  operationId: string
  tipo: TipoOperacion
  estado: EstadoServidor
  conflictos: TipoConflicto[]
  motivo: string | null
  serverId: number | null
  deviceId: string
  sucursal: { idSucursal: number; nombre: string } | null
  usuario: { idUsuario: number; nombre: string; rol: string | null } | null
  creadaLocalEn: string
  recibidaEn: string
  intentos: number
  detalle: { items: { idVariante: number; cantidad: number; precioLocal?: number; precioServidor?: number; faltante?: number }[]; alternativas?: Alternativa[] } | null
  resuelta: boolean
  resueltaEn: string | null
  notaResolucion: string | null
}

export const syncApi = {
  catalogo: (idSucursal: number) =>
    api.get<CatalogoSync>('/sync/catalog', { params: { sucursal: idSucursal } }).then(r => r.data),
  enviar: (deviceId: string, operations: OperacionEnviada[]) =>
    api.post<{ serverTime: string; results: ResultadoSync[] }>('/sync/operations', { deviceId, operations }).then(r => r.data),
  operaciones: (pendientes: boolean) =>
    api.get<OperacionPanel[]>('/sync/operaciones', { params: pendientes ? { pendientes: 'true' } : {} }).then(r => r.data),
  resumen: () =>
    api.get<{ pendientes: number; ultimas24h: { confirmadas: number; conflictos: number; rechazadas: number } }>('/sync/resumen').then(r => r.data),
  resolver: (id: number, nota: string) =>
    api.patch<OperacionPanel>(`/sync/operaciones/${id}/resolver`, { nota }).then(r => r.data),
}
