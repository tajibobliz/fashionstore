import { api } from './axios'
export interface CreateReturnRequest { idVenta: number; motivo?: string; detalles: { idDetalleVenta: number; cantidad: number }[] }
export const returnsApi = { list: () => api.get('/returns').then(r => r.data), get: (id: number) => api.get(`/returns/${id}`).then(r => r.data), bySale: (idVenta: number) => api.get(`/returns/venta/${idVenta}`).then(r => r.data), create: (body: CreateReturnRequest) => api.post('/returns', body).then(r => r.data) }
