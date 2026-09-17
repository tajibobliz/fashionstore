import type { Sucursal } from './branch'
import type { Almacen } from './warehouse'

export interface Caja { idCaja: number; idSucursal?: number; idAlmacenDefault?: number; sucursal?: Sucursal; almacenDefault?: Almacen | null; codigo: string; nombre: string; estado: boolean }
export interface CreateCajaRequest { idSucursal: number; codigo: string; nombre: string; idAlmacenDefault?: number; estado?: boolean }
export interface TurnoCaja { idTurno: number; estado: 'ABIERTO' | 'CERRADO'; fechaApertura: string; fechaCierre?: string }
export interface AbrirTurnoRequest { idCaja: number; montoApertura: number }; export interface CerrarTurnoRequest { montoCierreDeclarado: number }
