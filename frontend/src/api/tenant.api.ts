import { api } from './axios'
import type { CodigoPlan } from './saas.api'

export interface TenantResumen {
  empresa: { idEmpresa: number; nombre: string; slug: string; estado: 'ACTIVA' | 'SUSPENDIDA' }
  suscripcion: {
    idSuscripcion?: number
    estado: 'ACTIVA' | 'VENCIDA' | 'SIN_SUSCRIPCION'
    fechaInicio?: string
    fechaVencimiento?: string
    diasRestantes?: number | null
  }
  plan: { codigo: CodigoPlan; nombre: string; features: { aiReports?: boolean; ml?: boolean } } | null
  limites: {
    sucursales: { usadas: number; maximo: number | null }
    usuarios: { usados: number; maximo: number | null }
  }
}

export interface SuscripcionHistorial {
  idSuscripcion: number
  estado: 'ACTIVA' | 'VENCIDA' | 'CANCELADA'
  fechaInicio: string
  fechaVencimiento: string
  createdAt: string
  plan: { codigo: CodigoPlan; nombre: string }
}

/** Datos de la empresa del usuario logueado (plan, vigencia, límites). */
export const tenantApi = {
  async me() {
    const { data } = await api.get<TenantResumen>('/tenant/me')
    return data
  },
  async historial() {
    const { data } = await api.get<SuscripcionHistorial[]>('/tenant/suscripciones')
    return data
  },
  /** Cambiar o renovar el plan (contratación simulada). */
  async cambiarPlan(codigoPlan: CodigoPlan, meses = 1) {
    const { data } = await api.post<TenantResumen>('/tenant/suscripcion', { codigoPlan, meses })
    return data
  },
}
