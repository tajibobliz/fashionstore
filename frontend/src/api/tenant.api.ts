import { api } from './axios'
import type { CodigoPlan } from './saas.api'

export interface TenantResumen {
  empresa: { idEmpresa: number; nombre: string; slug: string; estado: 'ACTIVA' | 'SUSPENDIDA'; moneda?: string }
  suscripcion: {
    idSuscripcion?: number
    estado: 'ACTIVA' | 'VENCIDA' | 'SIN_SUSCRIPCION'
    fechaInicio?: string
    fechaVencimiento?: string
    diasRestantes?: number | null
  }
  plan: { codigo: CodigoPlan; nombre: string; features: { aiReports?: boolean; ml?: boolean; pagosOnline?: boolean } } | null
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
  /** Plazo (horas) para operar sin conexión con el PIN, desde la última conexión (CU17). */
  async cambiarSesionOffline(horasSesionOffline: number) {
    const { data } = await api.patch<{ horasSesionOffline: number }>('/tenant/sesion-offline', { horasSesionOffline })
    return data
  },
  /** El administrador elige la moneda en la que vende su tienda (no convierte precios). */
  async cambiarMoneda(moneda: string) {
    const { data } = await api.patch<{ moneda: string }>('/tenant/moneda', { moneda })
    return data
  },
}
