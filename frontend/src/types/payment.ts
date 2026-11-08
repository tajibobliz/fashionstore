export type MetodoPago = 'EFECTIVO' | 'TARJETA' | 'QR' | 'TRANSFERENCIA' | 'CONTRAPAGO'; export type EstadoPago = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'ANULADO'
export interface CreatePagoRequest { idVenta: number; metodo: MetodoPago; monto: number; referenciaPasarela?: string; clientRequestId?: string }
export interface Pago { idPago: number; idVenta: number; metodo: MetodoPago; monto: number | string; estado?: EstadoPago; referenciaPasarela?: string | null; fecha?: string }

/** Medios de pago que la tienda acepta en su tienda online (los configura el ADMIN). */
export interface ConfigPagoTienda {
  tarjeta: boolean; qr: boolean; transferencia: boolean; efectivoRetiro: boolean; contraentrega: boolean
  qrMime?: string | null; qrSubido?: boolean; actualizadoEn?: string; proveedorTarjeta?: 'STRIPE' | 'SIMULADO'
  banco: string | null; titular: string | null; numeroCuenta: string | null; tipoCuenta: string | null; documentoTitular: string | null; instrucciones: string | null
}
/** Lo que ve la clienta al pagar. */
export interface MetodosTienda {
  moneda: string; proveedorTarjeta: 'STRIPE' | 'SIMULADO'
  tarjeta: boolean; qr: boolean; transferencia: boolean; efectivoRetiro: boolean; contraentrega: boolean
  cuenta: { banco: string | null; titular: string | null; numeroCuenta: string | null; tipoCuenta: string | null; documentoTitular: string | null } | null
  instrucciones: string | null
}
export interface PagoPorVerificar {
  idPago: number; metodo: MetodoPago; monto: number; montoTexto: string; fecha: string
  venta: { idVenta: number; comprobante: string | null; estado: string; sucursal: string | null }
  cliente: { nombre: string; email: string } | null
  comprobante: { mime: string; bytes: number; subidoEn: string } | null
}
