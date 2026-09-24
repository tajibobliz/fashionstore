import { Categoria, Coleccion, Color, Proveedor, Talla } from "./catalog.types";

// ===== Cart =====

export interface CartItemBackend {
  idDetalleCarrito: number;
  cantidad: number;
  precio: string | number;
  variante: VarianteEnDetalle;
}

export interface Cart {
  idCarrito: number;
  detalles: CartItemBackend[];
  sucursal?: { idSucursal: number; nombre: string } | null;
}

// ===== Enums =====

export type MetodoPago = "EFECTIVO" | "TARJETA" | "QR" | "TRANSFERENCIA";
export type ModalidadComercial = "MINORISTA" | "MAYORISTA";
export type TipoVenta = "DIGITAL" | "PRESENCIAL";
export type EstadoVenta =
  | "PENDIENTE"
  | "PAGADA"
  | "CANCELADA"
  | "DEVUELTA_PARCIAL"
  | "DEVUELTA";
export type EstadoPago = "PENDIENTE" | "APROBADO" | "RECHAZADO" | "ANULADO";

// ===== Estructuras internas de una venta =====

export interface VarianteEnDetalle {
  idVariante: number;
  sku: string;
  producto: {
    idProducto: number;
    nombre: string;
    descripcion: string;
    precio: string;
    imagenUrl: string | null;
    categoria: Categoria | null;
    proveedor: Proveedor | null;
    coleccion: Coleccion | null;
  };
  talla: Talla | null;
  color: Color | null;
}

export interface DetalleVenta {
  idDetalleVenta: number;
  cantidad: number;
  precioUnitario: string;
  subtotal: string;
  variante: VarianteEnDetalle;
}

export interface SucursalEnVenta {
  idSucursal: number;
  nombre: string;
  direccion: string;
  telefono: string | null;
  estado: boolean;
  ciudad: {
    idCiudad: number;
    nombre: string;
  };
}

// ===== Sale (respuesta del backend) =====

export interface Sale {
  idVenta: number;
  tipoVenta: TipoVenta;
  modalidadComercial: ModalidadComercial;
  clientRequestId: string | null;
  fecha: string;
  total: string;
  numeroComprobante: string;
  estado: EstadoVenta;
  sucursal: SucursalEnVenta;
  detalles: DetalleVenta[];
}

// ===== DTOs =====

export interface CreateSaleFromCartDto {
  idSucursal: number;
  modalidadComercial?: ModalidadComercial;
  clientRequestId?: string;
}

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
