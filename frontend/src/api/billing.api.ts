import { api } from './axios'
import type { CodigoPlan } from './saas.api'

export type EstadoPago = 'PENDIENTE' | 'PAGADO' | 'CANCELADO' | 'EXPIRADO'

export interface PagoSuscripcion {
  referencia: string
  estado: EstadoPago
  proveedor: 'STRIPE' | 'SIMULADO'
  codigoPlan: CodigoPlan
  nombrePlan: string
  meses: number
  /** En USD. */
  monto: number
  moneda: string
  creadoEn: string
  pagadoEn: string | null
}

export interface Checkout {
  referencia: string
  /** Página de pago (Stripe Checkout o la pantalla simulada). */
  url: string
  proveedor: 'STRIPE' | 'SIMULADO'
  /** Plan sin costo: quedó activo sin pasar por la pasarela. */
  activadoSinPago?: boolean
}

/** Pago de la suscripción de la tienda a la plataforma (planes en USD). */
export const billingApi = {
  checkout: (codigoPlan: CodigoPlan, meses = 1) => api.post<Checkout>('/billing/checkout', { codigoPlan, meses }).then(r => r.data),
  pago: (referencia: string) => api.get<PagoSuscripcion>(`/billing/pagos/${encodeURIComponent(referencia)}`).then(r => r.data),
  historial: () => api.get<PagoSuscripcion[]>('/billing/pagos').then(r => r.data),
  cancelar: (referencia: string) => api.post<PagoSuscripcion>(`/billing/pagos/${encodeURIComponent(referencia)}/cancelar`).then(r => r.data),
  pagarSimulado: (referencia: string) => api.post<PagoSuscripcion>(`/billing/simulado/${encodeURIComponent(referencia)}/pagar`).then(r => r.data),
}

/** Lleva el navegador a la página de pago (sale de la aplicación, como en Stripe Checkout). */
export function irAPagar(checkout: Checkout) {
  if (checkout.activadoSinPago || !checkout.url) return false
  window.location.assign(checkout.url)
  return true
}
