import { formatMoney } from '../../utils/money'
/** Formatos compartidos por las pantallas de ML. */
export const fechaCorta = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(2, 4)}`
export const numero = (n: number, decimales = 0) =>
  n.toLocaleString('es-BO', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })
/** Monto en la moneda de la tienda. */
export const monto = (n: number) => formatMoney(n)
