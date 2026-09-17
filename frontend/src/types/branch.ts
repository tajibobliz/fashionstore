export interface Ciudad { idCiudad: number; nombre: string; estado?: boolean }
export interface Sucursal { idSucursal: number; nombre: string; direccion: string; telefono?: string; estado: boolean; ciudad?: Ciudad }
export interface CreateCiudadRequest { nombre: string; estado?: boolean }
export interface CreateSucursalRequest { idCiudad: number; nombre: string; direccion: string; telefono?: string; estado?: boolean }
