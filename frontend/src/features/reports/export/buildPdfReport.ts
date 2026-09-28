import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ReportExportData } from './reportExportData'
import { nombreArchivo } from './reportExportData'

// Color de marca (--app-primary en DashboardLayout.module.css) para los encabezados de tabla.
const HEADER_COLOR: [number, number, number] = [173, 62, 104]
const PAGE_BOTTOM = 275

function finalY(doc: jsPDF): number {
  // jspdf-autotable no tipa esta propiedad en su .d.ts empaquetado, pero sí la asigna en tiempo de
  // ejecución sobre la instancia de jsPDF (ver dist/jspdf.plugin.autotable.js).
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
}

/** Título de sección + tabla; si no entra en lo que queda de página, arranca una nueva antes de dibujar. */
function seccion(doc: jsPDF, y: number, titulo: string, head: string[], body: (string | number)[][]) {
  let cursor = y
  if (cursor > PAGE_BOTTOM - 20) {
    doc.addPage()
    cursor = 20
  }
  doc.setFontSize(12)
  doc.setTextColor(20)
  doc.text(titulo, 14, cursor)
  autoTable(doc, {
    startY: cursor + 4,
    head: [head],
    body,
    headStyles: { fillColor: HEADER_COLOR },
    styles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
  })
  return finalY(doc) + 10
}

// Solo tablas (nada de gráficos como imagen: jsPDF no tiene forma simple de "capturar" un <svg> de
// recharts sin agregar otra dependencia de captura de pantalla, que complicaría bastante esto).
export function buildPdfReport(data: ReportExportData) {
  const doc = new jsPDF()

  doc.setFontSize(18)
  doc.setTextColor(20)
  doc.text('Reporte FashionStore', 14, 18)
  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text(`Rango consultado: ${data.rangoLabel}`, 14, 25)
  doc.text(`Generado el ${new Date().toLocaleString('es-BO')}`, 14, 30)

  let y = seccion(doc, 40, 'Indicadores', ['Indicador', 'Valor'], data.kpis.map(k => [k.label, k.value]))
  y = seccion(doc, y, 'Ventas por día', ['Fecha', 'Cantidad', 'Monto (Bs)'], data.ventasPorDia.map(v => [v.fecha, v.cantidad, v.monto.toFixed(2)]))
  y = seccion(doc, y, 'Top productos', ['Producto', 'Categoría', 'Cantidad vendida', 'Total generado (Bs)'], data.topProductos.map(p => [p.nombre, p.categoria ?? '—', p.cantidadVendida, p.totalGenerado.toFixed(2)]))
  seccion(doc, y, 'Ventas por sucursal', ['Sucursal', 'Cantidad de ventas', 'Unidades vendidas', 'Total vendido (Bs)'], data.ventasPorSucursal.map(s => [s.sucursal, s.cantidadVentas, s.unidadesVendidas, s.totalVendido.toFixed(2)]))

  doc.save(nombreArchivo('pdf'))
}
