import axios from 'axios'
import { api } from './axios'; import type { ConfirmPaymentResult, CreatePagoRequest, EstadoPago, Pago } from '../types/payment'
export const paymentsApi = { list: () => api.get<Pago[]>('/payments').then(r => r.data), get: (id: number) => api.get<Pago>(`/payments/${id}`).then(r => r.data), bySale: (idVenta: number) => api.get<Pago[]>(`/payments/venta/${idVenta}`).then(r => r.data), create: (body: CreatePagoRequest) => api.post<Pago>('/payments', body).then(r => r.data), updateStatus: (id: number, estado: EstadoPago, referenciaPasarela?: string) => api.patch<Pago>(`/payments/${id}/estado`, { estado, referenciaPasarela }).then(r => r.data),
  // Vuelta del portal de pago: sin token propio, como cualquier redirect externo.
  confirmPayment: (idPago: number) => axios.post<ConfirmPaymentResult>(`${api.defaults.baseURL}/mock-gateway/process/${idPago}`).then(r => r.data) }
