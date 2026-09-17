import type { Role } from '../features/auth/types'
export interface User { idUsuario: number; nombre: string; apellido?: string; email: string; telefono?: string; estado: boolean; rol: { nombre: Role } | Role }
export interface CreateUserRequest { nombre: string; email: string; password: string; apellido?: string; telefono?: string; rolNombre: Role }
export interface AssignBranchRequest { idSucursal: number }
