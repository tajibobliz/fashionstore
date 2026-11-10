import { api } from './axios'

export type EstadoTraspaso = 'EN_TRANSITO' | 'RECIBIDO' | 'RECIBIDO_PARCIAL' | 'RECHAZADO' | 'CANCELADO'

export interface StockTraspaso {
  sucursales: { idSucursal: number; nombre: string }[]
  /** Sucursales desde las que el usuario puede enviar (las que opera). */
  origenesPermitidos: number[]
  variantes: {
    idVariante: number
    sku: string
    producto: string
    talla: string | null
    color: string | null
    /** Stock disponible por id de sucursal. */
    stock: Record<string, number>
  }[]
}

export interface Traspaso {
  idTraspaso: number
  estado: EstadoTraspaso
  origen: { idSucursal: number; nombre: string }
  destino: { idSucursal: number; nombre: string }
  observacion: string | null
  fechaEnvio: string
  enviadoPor: string | null
  fechaCierre: string | null
  cerradoPor: string | null
  observacionCierre: string | null
  unidades: number
  merma: number
  detalles: {
    idDetalleTraspaso: number
    idVariante: number
    sku: string
    prenda: string
    cantidadEnviada: number
    cantidadRecibida: number | null
    merma: number
  }[]
  puedeRecibir: boolean
  puedeCancelar: boolean
}

export interface NuevoTraspaso {
  idSucursalOrigen: number
  idSucursalDestino: number
  observacion?: string
  detalles: { idVariante: number; cantidad: number }[]
}

export const transfersApi = {
  stock: (q?: string) => api.get<StockTraspaso>('/transfers/stock', { params: q ? { q } : {} }).then(r => r.data),
  listar: (estado?: EstadoTraspaso) => api.get<Traspaso[]>('/transfers', { params: estado ? { estado } : {} }).then(r => r.data),
  pendientes: () => api.get<{ porRecibir: number }>('/transfers/pendientes').then(r => r.data),
  crear: (body: NuevoTraspaso) => api.post<Traspaso>('/transfers', body).then(r => r.data),
  recibir: (id: number, body: { detalles: { idDetalleTraspaso: number; cantidadRecibida: number }[]; observacion?: string }) =>
    api.post<Traspaso>(`/transfers/${id}/recibir`, body).then(r => r.data),
  cancelar: (id: number, motivo?: string) => api.post<Traspaso>(`/transfers/${id}/cancelar`, motivo ? { motivo } : {}).then(r => r.data),
}
