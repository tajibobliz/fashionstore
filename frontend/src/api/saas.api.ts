import { api } from './axios'
import type { AuthResponse } from '../features/auth/types'
import { authSession } from '../features/auth/session'

export type CodigoPlan = 'BASICO' | 'PROFESIONAL' | 'EMPRESARIAL'

export interface PlanPublico {
  codigo: CodigoPlan
  nombre: string
  /** null = ilimitado */
  maxSucursales: number | null
  maxUsuarios: number | null
  features: { aiReports?: boolean; ml?: boolean }
  precioReferencia: number
}

export interface RegistroEmpresaInput {
  nombre: string
  slug: string
  nit?: string
  codigoPlan: CodigoPlan
  admin: { nombre: string; apellido?: string; email: string; password: string }
}

/** Endpoints públicos de la página del SaaS (planes y contratación). */
export const saasApi = {
  async planes() {
    const { data } = await api.get<PlanPublico[]>('/saas/planes')
    return data
  },
  async slugDisponible(slug: string) {
    const { data } = await api.get<{ slug: string; disponible: boolean }>('/saas/slug-disponible', { params: { slug } })
    return data
  },
  /** Crea la empresa con su plan y su administrador, y deja la sesión iniciada. */
  async registrar(input: RegistroEmpresaInput) {
    const { data } = await api.post<AuthResponse>('/saas/registro', input)
    authSession.set(data.access_token, data.user, data.refresh_token)
    return data.user
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
