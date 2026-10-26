export type Role = 'SUPER_ADMIN' | 'CLIENTE' | 'ADMIN' | 'ENCARGADO' | 'ENCARGADO_SUCURSAL' | 'CAJERO' | 'PROVEEDOR'

export interface AuthUser {
  idUsuario: number
  email: string
  rol: Role
  nombre?: string
  /** Empresa (tenant) del usuario. null = usuario de la plataforma (SUPER_ADMIN). */
  idEmpresa?: number | null
  empresa?: { idEmpresa: number; nombre: string; slug: string } | null
}

export interface LoginInput {
  email: string
  password: string
  /** Slug de la empresa. Vacío = FashionStore o usuario de la plataforma. */
  empresa?: string
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
