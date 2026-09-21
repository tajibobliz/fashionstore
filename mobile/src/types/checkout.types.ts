// ===== Cart (respuestas del backend) =====

export interface CartItemBackend {
  idItem: number;
  idVariante: number;
  cantidad: number;
  precioUnitario: string;
}

export interface Cart {
  idCarrito: number;
  items: CartItemBackend[];
}

// ===== Sales (venta) =====

export type MetodoPago = "EFECTIVO" | "TARJETA" | "QR" | "TRANSFERENCIA";
export type ModalidadComercial = "MINORISTA" | "MAYORISTA";

export type EstadoVenta =
  | "PENDIENTE"
  | "PAGADA"
  | "CANCELADA"
  | "DEVUELTA_PARCIAL"
  | "DEVUELTA";

export interface CreateSaleFromCartDto {
  idSucursal: number;
  modalidadComercial?: ModalidadComercial;
  clientRequestId?: string;
}

export interface Sale {
  idVenta: number;
  fecha: string;
  total: string;
  estado: EstadoVenta;
  idSucursal?: number;
}

// ===== Payments (pagos) =====

export type EstadoPago = "PENDIENTE" | "APROBADO" | "RECHAZADO" | "ANULADO";

export interface CreatePaymentDto {
  idVenta: number;
  metodo: MetodoPago;
  monto: number;
  referenciaPasarela?: string;
}

export interface Payment {
  idPago: number;
  idVenta: number;
  metodo: MetodoPago;
  monto: string;
  estado: EstadoPago;
  referenciaPasarela?: string;
}