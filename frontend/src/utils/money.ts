/**
 * Montos con la moneda correcta.
 *
 * - Los PLANES del SaaS se muestran en USD (moneda de la plataforma, igual en todos los países).
 * - Todo lo de una TIENDA (precios, ventas, reportes, exportaciones) usa la moneda de esa tienda:
 *   `empresa.moneda`. No depende de dónde esté quien mira, sino de quién vende.
 *
 * La "moneda actual" la fija el contenedor de la página durante el render, igual que el slug
 * de la tienda (ver StoreScope y DashboardLayout): en la tienda online, la de la tienda que se
 * visita; en el panel, la de la empresa del usuario. Así cualquier componente o exportación
 * (PDF, Excel) puede llamar a `formatMoney(n)` sin recibir la moneda por props.
 */
export interface Moneda {
  codigo: string
  nombre: string
  simbolo: string
  decimales: number
  /** Cómo se lee en voz alta (síntesis de voz de los reportes). */
  hablada: string
}

export const MONEDAS: Moneda[] = [
  { codigo: 'BOB', nombre: 'Boliviano', simbolo: 'Bs', decimales: 2, hablada: 'bolivianos' },
  { codigo: 'USD', nombre: 'Dólar estadounidense', simbolo: 'US$', decimales: 2, hablada: 'dólares' },
  { codigo: 'ARS', nombre: 'Peso argentino', simbolo: '$', decimales: 2, hablada: 'pesos' },
  { codigo: 'BRL', nombre: 'Real brasileño', simbolo: 'R$', decimales: 2, hablada: 'reales' },
  { codigo: 'CLP', nombre: 'Peso chileno', simbolo: '$', decimales: 0, hablada: 'pesos' },
  { codigo: 'COP', nombre: 'Peso colombiano', simbolo: '$', decimales: 0, hablada: 'pesos' },
  { codigo: 'EUR', nombre: 'Euro', simbolo: '€', decimales: 2, hablada: 'euros' },
  { codigo: 'MXN', nombre: 'Peso mexicano', simbolo: '$', decimales: 2, hablada: 'pesos' },
  { codigo: 'PEN', nombre: 'Sol peruano', simbolo: 'S/', decimales: 2, hablada: 'soles' },
  { codigo: 'PYG', nombre: 'Guaraní', simbolo: '₲', decimales: 0, hablada: 'guaraníes' },
]

/** Moneda en la que la plataforma cobra los planes. */
export const MONEDA_PLANES = 'USD'
const POR_DEFECTO = 'BOB'

let actual = POR_DEFECTO

export const monedaActual = {
  /** Lo llaman StoreScope (tienda visitada) y DashboardLayout (empresa del usuario). */
  set(codigo: string | null | undefined) { actual = MONEDAS.some(m => m.codigo === codigo) ? codigo! : POR_DEFECTO },
  get: () => actual,
}

export function moneda(codigo: string | null | undefined = actual): Moneda {
  return MONEDAS.find(m => m.codigo === codigo) ?? MONEDAS[0]
}

export const simboloMoneda = (codigo?: string | null) => moneda(codigo ?? actual).simbolo

/** Número con los decimales de la moneda, sin símbolo ("1.234,50"; CLP → "15.990"). */
export function formatNumberMoney(valor: number | string | null | undefined, codigo?: string | null, decimales?: number) {
  const m = moneda(codigo ?? actual)
  const d = decimales ?? m.decimales
  const n = Number(valor ?? 0)
  return (Number.isFinite(n) ? n : 0).toLocaleString('es-BO', { minimumFractionDigits: d, maximumFractionDigits: d })
}

/** "Bs 1.234,50" · "US$ 19,00" · "$ 15.990". */
export function formatMoney(valor: number | string | null | undefined, codigo?: string | null, decimales?: number) {
  return `${simboloMoneda(codigo)} ${formatNumberMoney(valor, codigo, decimales)}`
}

/** Precio de un plan del SaaS: siempre en USD y sin centavos si son cero ("US$ 19"). */
export function formatPlanPrice(valor: number) {
  return formatMoney(valor, MONEDA_PLANES, Number.isInteger(valor) ? 0 : 2)
}

/** Formato numérico de Excel para montos de la moneda: '"Bs" #,##0.00' o '"$" #,##0'. */
export function excelMoneyFormat(codigo?: string | null) {
  const m = moneda(codigo ?? actual)
  return `"${m.simbolo}" #,##0${m.decimales ? '.' + '0'.repeat(m.decimales) : ''}`
}

/** "Vendió Bs 1.234,50" → "Vendió 1.234,50 bolivianos" (para leer en voz alta). */
export function montosParaVoz(texto: string, codigo?: string | null) {
  const m = moneda(codigo ?? actual)
  const simbolo = m.simbolo.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
  return texto.replace(new RegExp(`${simbolo}\\.?\\s?(\\d[\\d.,]*\\d|\\d)`, 'g'), `$1 ${m.hablada}`)
}
