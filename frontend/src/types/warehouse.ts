import type { Sucursal } from './branch'

export interface Almacen { idAlmacen: number; idSucursal?: number; sucursal?: Sucursal; codigo: string; nombre: string; estado: boolean }
export interface CreateAlmacenRequest { idSucursal: number; codigo: string; nombre: string; estado?: boolean }
