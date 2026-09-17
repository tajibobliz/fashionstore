export interface DetalleDevolucionRequest { idDetalleVenta: number; cantidad: number }
export interface CreateDevolucionRequest { idVenta: number; motivo?: string; detalles: DetalleDevolucionRequest[] }
export interface Devolucion { idDevolucion: number; idVenta: number; motivo?: string }
