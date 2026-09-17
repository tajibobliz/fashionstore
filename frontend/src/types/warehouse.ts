export interface Almacen { idAlmacen: number; idSucursal?: number; codigo: string; nombre: string; estado: boolean }
export interface CreateAlmacenRequest { idSucursal: number; codigo: string; nombre: string; estado?: boolean }
