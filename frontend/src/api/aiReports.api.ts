import { api } from './axios'

/** Contrato de POST /ai/reports/query (Fase 3, tarea 3.1). */
export type FormatoColumna = 'texto' | 'numero' | 'moneda' | 'fecha' | 'porcentaje'
export interface ColumnaReporte { clave: string; etiqueta: string; formato: FormatoColumna }
export interface GraficoReporte { tipo: 'linea' | 'barras' | 'torta'; x: string; y: string[] }
export type Celda = string | number | null
export interface ReporteIa {
  herramienta: string
  titulo: string
  columnas: ColumnaReporte[]
  filas: Record<string, Celda>[]
  grafico: GraficoReporte | null
  filtros: Record<string, string>
  resumen: Record<string, number>
}
export interface RespuestaReporteIa {
  tipo: 'reporte' | 'aclaracion' | 'sin_reporte'
  consulta: string
  narrativa: string | null
  aclaracion: string | null
  reportes: ReporteIa[]
  meta: { idConsulta: number; proveedor: string; modelo: string | null; iteraciones: number; tokensEntrada: number; tokensSalida: number; duracionMs: number }
}
export interface TurnoHistorial { rol: 'usuario' | 'asistente'; texto: string }
export interface ConsultaRegistrada {
  idConsulta: number
  consulta: string
  estado: 'OK' | 'ACLARACION' | 'SIN_REPORTE' | 'ERROR'
  herramientas: string[]
  usuario: string | null
  modelo: string | null
  tokens: number
  duracionMs: number
  creadaEn: string
}

export const aiReportsApi = {
  consultar: (consulta: string, historial: TurnoHistorial[] = []) =>
    api.post<RespuestaReporteIa>('/ai/reports/query', { consulta, historial: historial.length ? historial : undefined }).then(r => r.data),
  historial: () => api.get<ConsultaRegistrada[]>('/ai/reports/historial').then(r => r.data),
}
