import type { Celda, ColumnaReporte, ReporteIa } from '../../api/aiReports.api'
import { CHART_PRIMARY } from '../reports/charts/colors'
import { formatMoney } from '../../utils/money'

/** Colores de las series cuando el gráfico compara varias medidas (p. ej. devueltas vs. cambiadas). */
export const COLORES_SERIES = [CHART_PRIMARY, '#2563eb', '#d97706']

const numero = new Intl.NumberFormat('es-BO')
const porcentaje = new Intl.NumberFormat('es-BO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const mes = new Intl.DateTimeFormat('es-BO', { month: 'short', year: 'numeric', timeZone: 'UTC' })

/** Fecha AAAA-MM-DD del backend; si el reporte está agrupado por mes, muestra "nov. 2026". */
function fecha(valor: string, porMes: boolean) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor)
  if (!m) return valor
  if (porMes) return mes.format(new Date(Date.UTC(+m[1], +m[2] - 1, 1)))
  return `${m[3]}/${m[2]}/${m[1]}`
}

export function formatear(valor: Celda, col: ColumnaReporte, reporte: ReporteIa): string {
  if (valor === null || valor === undefined || valor === '') return '—'
  switch (col.formato) {
    case 'moneda': return formatMoney(Number(valor), reporte.moneda)
    case 'numero': return numero.format(Number(valor))
    case 'porcentaje': return `${porcentaje.format(Number(valor))} %`
    case 'fecha': return fecha(String(valor), reporte.filtros['Agrupado por'] === 'mes')
    default: return String(valor)
  }
}

/** Valor numérico para gráficos y Excel (las celdas de texto quedan igual). */
export function valorPlano(valor: Celda, col: ColumnaReporte, reporte: ReporteIa): string | number {
  if (valor === null || valor === undefined) return ''
  if (col.formato === 'moneda' || col.formato === 'numero' || col.formato === 'porcentaje') return Number(valor)
  if (col.formato === 'fecha') return formatear(valor, col, reporte)
  return String(valor)
}

export function nombreArchivo(reporte: ReporteIa, ext: 'pdf' | 'xlsx') {
  const base = reporte.titulo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const hoy = new Date()
  const dia = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
  return `reporte-ia-${base}-${dia}.${ext}`
}

export const esNumerica = (formato: ColumnaReporte['formato']) => formato === 'moneda' || formato === 'numero' || formato === 'porcentaje'
