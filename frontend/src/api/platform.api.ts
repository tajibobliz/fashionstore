import { api } from './axios'
import type { CodigoPlan, RegistroEmpresaInput } from './saas.api'
import type { SuscripcionHistorial, TenantResumen } from './tenant.api'

export interface PlanAdmin {
  idPlan: number
  codigo: CodigoPlan
  nombre: string
  maxSucursales: number | null
  maxUsuarios: number | null
  features: { aiReports?: boolean; ml?: boolean }
  precioReferencia: number | string
  activo: boolean
}

export type PlanCambios = Partial<Pick<PlanAdmin, 'nombre' | 'maxSucursales' | 'maxUsuarios' | 'features' | 'activo'>> & { precioReferencia?: number }

/** Administración de la plataforma (solo SUPER_ADMIN). */
export const platformApi = {
  async empresas() {
    const { data } = await api.get<TenantResumen[]>('/platform/empresas')
    return data
  },
  async crearEmpresa(input: RegistroEmpresaInput & { meses?: number }) {
    const { data } = await api.post<TenantResumen>('/platform/empresas', input)
    return data
  },
  async historial(idEmpresa: number) {
    const { data } = await api.get<SuscripcionHistorial[]>(`/platform/empresas/${idEmpresa}/suscripciones`)
    return data
  },
  async cambiarEstado(idEmpresa: number, estado: 'ACTIVA' | 'SUSPENDIDA') {
    const { data } = await api.patch<TenantResumen>(`/platform/empresas/${idEmpresa}/estado`, { estado })
    return data
  },
  async cambiarPlan(idEmpresa: number, codigoPlan: CodigoPlan, meses: number) {
    const { data } = await api.post<TenantResumen>(`/platform/empresas/${idEmpresa}/suscripcion`, { codigoPlan, meses })
    return data
  },
  async fijarVencimiento(idEmpresa: number, fechaVencimiento: string) {
    const { data } = await api.patch<TenantResumen>(`/platform/empresas/${idEmpresa}/suscripcion/vencimiento`, { fechaVencimiento })
    return data
  },
  async planes() {
    const { data } = await api.get<PlanAdmin[]>('/platform/planes')
    return data
  },
  async actualizarPlan(idPlan: number, cambios: PlanCambios) {
    const { data } = await api.patch<PlanAdmin>(`/platform/planes/${idPlan}`, cambios)
    return data
  },
}
