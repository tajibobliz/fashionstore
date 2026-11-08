import type { MetodoPago } from '../../types/payment'

/** Nombre visible de cada medio de pago de la tienda online. */
export const NOMBRE_METODO: Record<MetodoPago, string> = {
  TARJETA: 'Tarjeta de débito o crédito',
  QR: 'QR',
  TRANSFERENCIA: 'Transferencia bancaria',
  EFECTIVO: 'Efectivo al retirar',
  CONTRAPAGO: 'Contra entrega',
}
export const nombreMetodo = (m: MetodoPago) => NOMBRE_METODO[m] ?? m
