export type MetodoPago = 'EFECTIVO' | 'TARJETA' | 'QR' | 'TRANSFERENCIA' | 'CONTRAPAGO'; export type EstadoPago = 'APROBADO' | 'RECHAZADO' | 'ANULADO'
export interface CreatePagoRequest { idVenta: number; metodo: MetodoPago; monto: number; referenciaPasarela?: string; clientRequestId?: string }
export interface Pago { idPago: number; idVenta: number; metodo: MetodoPago; monto: number | string; estado?: EstadoPago }
