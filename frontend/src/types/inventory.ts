export type MovimientoTipo = 'ENTRADA' | 'RESERVA' | 'LIBERACION_RESERVA' | 'VENTA' | 'DEVOLUCION' | 'AJUSTE'
export interface Inventario { idInventario: number; idSucursal: number; idAlmacen?: number; idVariante: number; stockDisponible: number; stockReservado: number }
export interface CreateInventarioRequest { idSucursal: number; idVariante: number; idAlmacen?: number; stockDisponible?: number; stockReservado?: number }
export interface CreateMovimientoRequest { idInventario: number; tipo: MovimientoTipo; cantidad: number; referencia?: string }
