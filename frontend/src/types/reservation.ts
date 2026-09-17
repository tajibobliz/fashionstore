export type ReservaEstado = 'PENDIENTE' | 'PREPARADA' | 'ATENDIDA' | 'CANCELADA'
export interface ReservaDetalle { idVariante: number; cantidad: number }
export interface CreateReservaRequest { idSucursal: number; detalles: ReservaDetalle[]; clientRequestId?: string }
export interface Reserva { idReserva: number; estado: ReservaEstado; idSucursal: number; clientRequestId?: string }
