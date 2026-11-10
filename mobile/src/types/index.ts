// Roles del sistema (deben coincidir con el enum del backend)
export type Role = "CLIENTE" | "ADMIN" | "ENCARGADO" | "ENCARGADO_SUCURSAL" | "CAJERO" | "PROVEEDOR" | "SUPER_ADMIN";

// Usuario que devuelve el backend
export interface User {
  idUsuario: number;
  nombre: string;
  apellido?: string;
  email: string;
  telefono?: string;
  rol: Role;
  /** Empresa (tienda del SaaS) a la que pertenece la cuenta. */
  idEmpresa?: number | null;
  empresa?: { idEmpresa: number; nombre: string; slug: string } | null;
}

// Respuesta del login/register
export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

// Producto del catálogo
export interface Producto {
  idProducto: number;
  nombre: string;
  descripcion?: string;
  precio: string;
  imagenUrl?: string;
  recursoRaUrl?: string;
  estado: boolean;
  categoria?: {
    idCategoria: number;
    nombre: string;
  };
}