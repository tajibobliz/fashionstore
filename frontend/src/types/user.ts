import type { Role } from '../features/auth/types'
import type { Sucursal } from './branch'
export interface User { idUsuario: number; nombre: string; apellido?: string; email: string; telefono?: string; estado: boolean; rol: { nombre: Role } | Role }
export interface CreateUserRequest { nombre: string; email: string; password: string; apellido?: string; telefono?: string; rolNombre: Role; idSucursales?: number[] }
export interface AssignBranchRequest { idSucursal: number }
export interface UserBranchAssignment { idUsuarioSucursal: number; sucursal: Sucursal; estado: boolean; createdAt?: string }
