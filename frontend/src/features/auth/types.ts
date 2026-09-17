export type Role = 'CLIENTE' | 'ADMIN' | 'ENCARGADO' | 'ENCARGADO_SUCURSAL' | 'CAJERO' | 'PROVEEDOR'

export interface AuthUser {
  idUsuario: number
  email: string
  rol: Role
  nombre?: string
}

export interface LoginInput {
  email: string
  password: string
}

export interface RegisterInput extends LoginInput {
  nombre: string
  apellido?: string
  telefono?: string
}

export interface AuthResponse {
  access_token: string
  refresh_token: string
  user: AuthUser
}
