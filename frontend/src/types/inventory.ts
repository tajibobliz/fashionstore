import type { Sucursal } from './branch'
import type { Variante } from './catalog'
import type { Almacen } from './warehouse'

export type MovimientoTipo = 'ENTRADA' | 'RESERVA' | 'LIBERACION_RESERVA' | 'VENTA' | 'DEVOLUCION' | 'AJUSTE'
export interface Inventario { idInventario: number; idSucursal?: number; idAlmacen?: number; idVariante?: number; sucursal?: Sucursal; almacen?: Almacen; variante?: Variante; stockDisponible: number; stockReservado: number }
export interface CreateInventarioRequest { idSucursal: number; idVariante: number; idAlmacen?: number; stockDisponible?: number; stockReservado?: number }
export interface CreateMovimientoRequest { idInventario: number; tipo: MovimientoTipo; cantidad: number; referencia?: string }
