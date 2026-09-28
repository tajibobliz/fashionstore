import type { DateRangeParams, PaginationParams } from './common'; import type { MetodoPago } from './payment'; import type { ModalidadComercial, TipoVenta } from './sale'
export interface ReportFilters extends DateRangeParams, PaginationParams { idSucursal?: number; idAlmacen?: number; tipoVenta?: TipoVenta; modalidadComercial?: ModalidadComercial; metodoPago?: MetodoPago; idCajero?: number; idCaja?: number; idTurno?: number }

// GET /reports/dashboard (= /reports/resumen, mismo endpoint)
export interface DashboardReporte { totalVentas: number; cantidadVentas: number; unidadesVendidas: number; ticketPromedio: number; reservasPendientes: number; stockCritico: number }
// GET /reports/ventas-por-dia (sin ruta moderna equivalente)
export interface VentaPorDia { fecha: string; cantidad: number; monto: number }
// GET /reports/products/top
export interface TopProducto { idProducto: number; nombre: string; categoria: string | null; cantidadVendida: number; totalGenerado: number }
// GET /reports/sales/by-branch
export interface VentaPorSucursal { idSucursal: number; sucursal: string; cantidadVentas: number; unidadesVendidas: number; totalVendido: number }
