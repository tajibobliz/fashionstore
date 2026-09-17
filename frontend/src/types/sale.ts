export type TipoVenta = 'DIGITAL' | 'PRESENCIAL'; export type ModalidadComercial = 'MINORISTA' | 'MAYORISTA'
export interface DetalleVentaRequest { idVariante: number; cantidad: number }
export interface CreateVentaCarritoRequest { idSucursal: number; modalidadComercial?: ModalidadComercial; clientRequestId?: string }
export interface CreateVentaPresencialRequest { idSucursal: number; detalles: DetalleVentaRequest[]; idCaja?: number; idUsuario?: number; idReserva?: number; modalidadComercial?: ModalidadComercial; clientRequestId?: string }
export interface Venta { idVenta: number; tipoVenta: TipoVenta; modalidadComercial?: ModalidadComercial; total?: number | string }
