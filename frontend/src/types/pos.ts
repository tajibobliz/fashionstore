export interface Caja { idCaja: number; idSucursal: number; idAlmacenDefault?: number; codigo: string; nombre: string; estado: boolean }
export interface CreateCajaRequest { idSucursal: number; codigo: string; nombre: string; idAlmacenDefault?: number; estado?: boolean }
export interface TurnoCaja { idTurno: number; estado: 'ABIERTO' | 'CERRADO'; fechaApertura: string; fechaCierre?: string }
export interface AbrirTurnoRequest { idCaja: number; montoApertura: number }; export interface CerrarTurnoRequest { montoCierreDeclarado: number }
