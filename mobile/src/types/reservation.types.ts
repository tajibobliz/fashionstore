import { VarianteEnDetalle, SucursalEnVenta } from "./checkout.types";

export type EstadoReserva =
  | "PENDIENTE"
  | "PREPARADA"
  | "ATENDIDA"
  | "CANCELADA";

export interface DetalleReserva {
  idDetalleReserva: number;
  cantidad: number;
  variante: VarianteEnDetalle;
}

export interface Reservation {
  idReserva: number;
  codigo: string;
  clientRequestId: string | null;
  fechaReserva: string;
  fechaAtencion: string | null;
  estado: EstadoReserva;
  sucursal: SucursalEnVenta;
  detalles: DetalleReserva[];
}

// DTO para crear reserva
export interface CreateReservationDto {
  idSucursal: number;
  detalles: {
    idVariante: number;
    cantidad: number;
  }[];
}