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

/** Número de pedido para mostrar: los comprobantes con UUID (DIG-/DIF-…) se muestran como #id. */
export const numeroPedido = (v: { idVenta: number; numeroComprobante?: string | null; comprobante?: string | null }) => {
  const c = v.numeroComprobante ?? v.comprobante
  return !c || /^[A-Z]{3}-[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(c) ? `#${v.idVenta}` : c
}
