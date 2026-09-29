import * as XLSX from 'xlsx'
import type { ReportExportData } from './reportExportData'
import { nombreArchivo } from './reportExportData'

// /reports/sales/export ya existe, pero devuelve CSV con ventas individuales (idVenta, comprobante...),
// no estos 4 conjuntos en hojas separadas. Se arma el libro acá, con los mismos datos ya cargados para
// los gráficos, en vez de pedirle al backend algo que no ofrece.
export function buildExcelReport(data: ReportExportData) {
  const wb = XLSX.utils.book_new()

  const kpiRows = [{ Indicador: 'Rango consultado', Valor: data.rangoLabel }, ...data.kpis.map(k => ({ Indicador: k.label, Valor: k.value }))]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kpiRows), 'KPIs')

  const diasRows = data.ventasPorDia.map(v => ({ Fecha: v.fecha, Cantidad: v.cantidad, 'Monto (Bs)': v.monto }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(diasRows), 'Ventas por dia')

  const productosRows = data.topProductos.map(p => ({ Producto: p.nombre, Categoría: p.categoria ?? '—', 'Cantidad vendida': p.cantidadVendida, 'Total generado (Bs)': p.totalGenerado }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(productosRows), 'Top productos')

  const sucursalesRows = data.ventasPorSucursal.map(s => ({ Sucursal: s.sucursal, 'Cantidad de ventas': s.cantidadVentas, 'Unidades vendidas': s.unidadesVendidas, 'Total vendido (Bs)': s.totalVendido }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sucursalesRows), 'Ventas por sucursal')

  XLSX.writeFile(wb, nombreArchivo('xlsx'))
}
