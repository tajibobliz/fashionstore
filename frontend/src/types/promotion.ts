export interface Promocion { idPromocion: number; nombre: string; porcentaje: number; estado?: boolean; fechaInicio?: string; fechaFin?: string }
export interface CreatePromocionRequest { nombre: string; porcentaje: number; fechaInicio?: string; fechaFin?: string; estado?: boolean; idsProductos?: number[]; idsCategorias?: number[]; idsTemporadas?: number[] }
