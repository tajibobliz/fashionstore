import type { VarianteProducto } from '@/types/catalog.types'

export interface Sucursal {
  idSucursal: number
  nombre: string
  direccion: string
  telefono: string | null
  estado: boolean
  ciudad?: { idCiudad: number; nombre: string }
}

export interface InventarioPublico {
  idInventario: number
  stockDisponible: number
  stockReservado: number
  sucursal: Sucursal
  variante: VarianteProducto & { producto: NonNullable<VarianteProducto['producto']> }
}
