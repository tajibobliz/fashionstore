import { api } from './axios'
import type { AuthResponse } from '../features/auth/types'
import type { Checkout } from './billing.api'
import { authSession } from '../features/auth/session'

export type CodigoPlan = 'BASICO' | 'PROFESIONAL' | 'EMPRESARIAL'

export interface PlanPublico {
  codigo: CodigoPlan
  nombre: string
  /** null = ilimitado */
  maxSucursales: number | null
  maxUsuarios: number | null
  features: { aiReports?: boolean; ml?: boolean; pagosOnline?: boolean }
  /** En USD: los planes de la plataforma se cobran en dólares en todos los países. */
  precioReferencia: number
  moneda?: string
}

export interface RegistroEmpresaInput {
  nombre: string
  slug: string
  nit?: string
  /** Moneda en la que venderá la tienda (por defecto BOB). */
  moneda?: string
  codigoPlan: CodigoPlan
  admin: { nombre: string; apellido?: string; email: string; password: string }
}

/** Endpoints públicos de la página del SaaS (planes y contratación). */
export const saasApi = {
  async planes() {
    const { data } = await api.get<PlanPublico[]>('/saas/planes')
    return data
  },
  /** Monedas que puede elegir una tienda. */
  async monedas() {
    const { data } = await api.get<{ codigo: string; nombre: string; simbolo: string; decimales: number }[]>('/saas/monedas')
    return data
  },
  async slugDisponible(slug: string) {
    const { data } = await api.get<{ slug: string; disponible: boolean }>('/saas/slug-disponible', { params: { slug } })
    return data
  },
  /** Datos públicos de una tienda (/t/:slug). */
  async tienda(slug: string) {
    const { data } = await api.get<{ idEmpresa: number; nombre: string; slug: string; moneda?: string }>(`/saas/tiendas/${encodeURIComponent(slug)}`)
    return data
  },
  /** Crea la empresa con su plan y su administrador, y deja la sesión iniciada. */
  /** Crea la empresa y su administrador (sesión iniciada) y devuelve el pago pendiente del plan. */
  async registrar(input: RegistroEmpresaInput) {
    const { data } = await api.post<AuthResponse & { checkout: Checkout }>('/saas/registro', input)
    authSession.set(data.access_token, data.user, data.refresh_token)
    return { user: data.user, checkout: data.checkout }
  },
}

/** "Bella Moda Santa Cruz" → "bella-moda-santa-cruz" */
export function slugify(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}
