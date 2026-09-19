export type ReservaEstado = 'PENDIENTE' | 'PREPARADA' | 'ATENDIDA' | 'CANCELADA'
export interface ReservaDetalle { idVariante: number; cantidad: number }
export interface CreateReservaRequest { idSucursal: number; detalles: ReservaDetalle[]; clientRequestId?: string }
export interface Reserva { idReserva: number; codigo?: string; estado: ReservaEstado; idSucursal?: number; clientRequestId?: string; fechaReserva?: string; sucursal?: { idSucursal: number; nombre: string }; detalles?: { cantidad: number; variante?: { sku: string; producto?: { nombre: string }; talla?: { nombre: string }; color?: { nombre: string } } }[] }
