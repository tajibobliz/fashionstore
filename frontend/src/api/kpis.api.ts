import { api } from './axios'

/** Respuesta de GET /reports/kpis (CU12). */
export interface Kpis {
  generadoEn: string
  hoy: string | null
  dias: number
  sucursal: string | null
  sucursales: { idSucursal: number; nombre: string }[]
  ventasHoy: { monto: number; cantidad: number; ayer: number; variacion: number | null }
  ventasMes: { monto: number; cantidad: number; unidades: number; ticketPromedio: number; mesAnterior: number; variacion: number | null; digital: number; presencial: number }
  stockCritico: { variantes: number; agotadas: number; umbral: number }
  reservasPendientes: number
  conflictosAbiertos: number
  devoluciones: { unidadesDevueltas: number; unidadesVendidas: number; tasa: number | null }
  cambios: { unidadesCambiadas: number; cambios: number; tasa: number | null }
  topCambiadas: { idProducto: number; producto: string; unidades: number; cambios: number }[]
  topDevueltas: { idProducto: number; producto: string; unidades: number }[]
  topPorSucursal: { idSucursal: number; sucursal: string; producto: string; unidades: number; monto: number }[]
  tendencia: { fecha: string; monto: number; ventas: number }[]
}

export const kpisApi = {
  obtener: (params: { idSucursal?: number; dias: number }) =>
    api.get<Kpis>('/reports/kpis', { params }).then(r => r.data),
}
