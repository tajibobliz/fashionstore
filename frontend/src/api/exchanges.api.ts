import { api } from './axios'

export interface LineaCambiable {
  idDetalleVenta: number
  cantidad: number
  devueltas: number
  cambiadas: number
  disponibles: number
  precioUnitario: number
  variante: { idVariante: number; sku: string; producto: string | null; idProducto: number | null; talla: string | null; color: string | null }
}

export interface CambioRegistrado {
  idCambio: number
  fecha: string
  motivo: string | null
  diferencia: number
  metodoPagoDiferencia: string | null
  venta: { idVenta: number; numeroComprobante: string | null; sucursal: string | null }
  registradoPor: string | null
  detalles: { cantidad: number; devuelve: string; entrega: string; precioOriginal: number; precioNuevo: number }[]
}

export interface ElegibilidadCambio {
  venta: {
    idVenta: number
    numeroComprobante: string | null
    fecha: string
    estado: string
    total: string | number
    sucursal: { idSucursal: number; nombre: string }
    cliente: { nombre: string; email: string } | null
  }
  plazoCambioDias: number
  venceEl: string
  dentroDelPlazo: boolean
  admiteCambio: boolean
  detalles: LineaCambiable[]
  cambios: CambioRegistrado[]
}

export interface CrearCambio {
  idVenta: number
  motivo?: string
  metodoPagoDiferencia?: string
  detalles: { idDetalleVenta: number; cantidad: number; idVarianteNueva: number }[]
}

export const exchangesApi = {
  politica: () => api.get<{ plazoCambioDias: number }>('/exchanges/politica').then(r => r.data),
  guardarPolitica: (plazoCambioDias: number) => api.patch<{ plazoCambioDias: number }>('/exchanges/politica', { plazoCambioDias }).then(r => r.data),
  venta: (idVenta: number) => api.get<ElegibilidadCambio>(`/exchanges/venta/${idVenta}`).then(r => r.data),
  listar: () => api.get<CambioRegistrado[]>('/exchanges').then(r => r.data),
  crear: (body: CrearCambio) => api.post<CambioRegistrado>('/exchanges', body).then(r => r.data),
}
