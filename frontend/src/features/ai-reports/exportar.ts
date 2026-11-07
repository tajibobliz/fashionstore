import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import type { ReporteIa } from '../../api/aiReports.api'
import { formatear, nombreArchivo, valorPlano } from './formato'

const COLOR_MARCA: [number, number, number] = [173, 62, 104]

/** PDF con la pregunta, el resumen de la IA, los filtros aplicados y la tabla completa. */
export function exportarPdf(reporte: ReporteIa, consulta: string, narrativa: string | null, empresa: string) {
  const doc = new jsPDF()
  doc.setFontSize(16)
  doc.setTextColor(20)
  doc.text(reporte.titulo, 14, 18)
  doc.setFontSize(9)
  doc.setTextColor(100)
  doc.text(`${empresa} · generado el ${new Date().toLocaleString('es-BO')} · Reporte con IA`, 14, 24)

  let y = 32
  const parrafo = (etiqueta: string, texto: string) => {
    doc.setFontSize(10)
    doc.setTextColor(20)
    doc.setFont('helvetica', 'bold')
    doc.text(etiqueta, 14, y)
    doc.setFont('helvetica', 'normal')
    const lineas = doc.splitTextToSize(texto, 180) as string[]
    doc.text(lineas, 14, y + 5)
    y += 5 + lineas.length * 5 + 3
  }
  parrafo('Pregunta', consulta)
  if (narrativa) parrafo('Resumen (generado por IA; las cifras oficiales son las de la tabla)', narrativa)
  parrafo('Filtros', Object.entries(reporte.filtros).map(([k, v]) => `${k}: ${v}`).join(' · '))

  const alineacion = reporte.columnas.map(c => (c.formato === 'texto' || c.formato === 'fecha' ? 'left' : 'right') as 'left' | 'right')
  autoTable(doc, {
    startY: y + 2,
    head: [reporte.columnas.map(c => c.etiqueta)],
    body: reporte.filas.map(f => reporte.columnas.map(c => formatear(f[c.clave], c, reporte))),
    headStyles: { fillColor: COLOR_MARCA },
    styles: { fontSize: 9 },
    columnStyles: Object.fromEntries(alineacion.map((halign, i) => [i, { halign }])),
    didParseCell: (d) => { if (d.section === 'head') d.cell.styles.halign = alineacion[d.column.index] },
    margin: { left: 14, right: 14 },
  })
  doc.save(nombreArchivo(reporte, 'pdf'))
}

/** Excel: hoja "Datos" con números reales (se pueden sumar) y hoja "Consulta" con el contexto. */
export function exportarExcel(reporte: ReporteIa, consulta: string, narrativa: string | null) {
  const wb = XLSX.utils.book_new()
  const filas = reporte.filas.map(f => Object.fromEntries(reporte.columnas.map(c => [c.etiqueta, valorPlano(f[c.clave], c, reporte)])))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas, { header: reporte.columnas.map(c => c.etiqueta) }), 'Datos')
  const contexto = [
    { Campo: 'Reporte', Valor: reporte.titulo },
    { Campo: 'Pregunta', Valor: consulta },
    { Campo: 'Resumen (IA)', Valor: narrativa ?? '' },
    ...Object.entries(reporte.filtros).map(([Campo, Valor]) => ({ Campo, Valor })),
    { Campo: 'Generado', Valor: new Date().toLocaleString('es-BO') },
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(contexto), 'Consulta')
  XLSX.writeFile(wb, nombreArchivo(reporte, 'xlsx'))
}
