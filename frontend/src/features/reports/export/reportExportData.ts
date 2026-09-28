import type { TopProducto, VentaPorDia, VentaPorSucursal } from '../../../types/report'

export interface ReportExportData {
  rangoLabel: string
  kpis: { label: string; value: string }[]
  ventasPorDia: VentaPorDia[]
  topProductos: TopProducto[]
  ventasPorSucursal: VentaPorSucursal[]
}

export function nombreArchivo(extension: string) {
  return `reporte-fashionstore-${new Date().toISOString().slice(0, 10)}.${extension}`
}
