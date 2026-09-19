import type { Variante } from './catalog'

export interface CartDetail {
  idDetalleCarrito: number
  cantidad: number
  precio: number | string
  variante: Variante
}
export interface Cart { idCarrito: number; estado: string; detalles: CartDetail[] }
