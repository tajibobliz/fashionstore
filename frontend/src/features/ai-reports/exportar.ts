import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ReporteIa } from '../../api/aiReports.api'
import { esNumerica, formatear, nombreArchivo, valorPlano } from './formato'
import type { ImagenGrafico } from './imagenGrafico'

/**
 * Exportación "con formato profesional" (CU11 / RF-017): cada archivo lleva los metadatos
 * de quién lo generó (empresa, usuario, rol, fecha y hora), la pregunta, el resumen de la IA,
 * los filtros, el gráfico y la tabla completa.
 */
export interface MetaExportacion {
  empresa: string
  usuario: string
  rol: string
}

interface Contenido {
  reporte: ReporteIa
  consulta: string
  narrativa: string | null
  meta: MetaExportacion
  grafico: ImagenGrafico | null
}

const MARCA: [number, number, number] = [173, 62, 104]
const ahora = () => new Date().toLocaleString('es-BO', { dateStyle: 'long', timeStyle: 'short' })

export function exportarPdf({ reporte, consulta, narrativa, meta, grafico }: Contenido) {
  const doc = new jsPDF()
  const ancho = doc.internal.pageSize.getWidth()
  const margen = 14
  const util = ancho - margen * 2
  const generado = ahora()

  // Encabezado
  doc.setFillColor(...MARCA)
  doc.rect(0, 0, ancho, 24, 'F')
  doc.setTextColor(255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(reporte.titulo, margen, 11)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`${meta.empresa} · Reporte generado con IA`, margen, 18)

  // Metadatos
  autoTable(doc, {
    startY: 30,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 34, textColor: 90 } },
    body: [
      ['Empresa', meta.empresa],
      ['Generado por', `${meta.usuario} (${meta.rol})`],
      ['Fecha y hora', generado],
      ['Pregunta', consulta],
      ['Filtros', Object.entries(reporte.filtros).map(([k, v]) => `${k}: ${v}`).join(' · ')],
    ],
    margin: { left: margen, right: margen },
  })
  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4

  if (narrativa) {
    // El corte de líneas depende del tamaño de letra: se fija antes de calcularlo.
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    const lineas = doc.splitTextToSize(narrativa, util - 8) as string[]
    const alto = lineas.length * 4.6 + 10
    doc.setFillColor(251, 240, 245)
    doc.roundedRect(margen, y, util, alto, 2, 2, 'F')
    doc.setTextColor(60)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('RESUMEN (IA) — las cifras oficiales son las de la tabla', margen + 4, y + 5)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(30)
    doc.text(lineas, margen + 4, y + 10)
    y += alto + 5
  }

  if (grafico) {
    const altoImg = Math.min(95, (util * grafico.alto) / grafico.ancho)
    const anchoImg = (altoImg * grafico.ancho) / grafico.alto
    if (y + altoImg > doc.internal.pageSize.getHeight() - 20) { doc.addPage(); y = 16 }
    // 'FAST' = compresión deflate; sin ella jsPDF guarda el PNG crudo (~4 MB por gráfico).
    doc.addImage(grafico.dataUrl, 'PNG', margen + (util - anchoImg) / 2, y, anchoImg, altoImg, undefined, 'FAST')
    y += altoImg + 5
  }

  autoTable(doc, {
    startY: y,
    head: [reporte.columnas.map(c => c.etiqueta)],
    body: reporte.filas.map(f => reporte.columnas.map(c => formatear(f[c.clave], c, reporte))),
    headStyles: { fillColor: MARCA },
    alternateRowStyles: { fillColor: [250, 247, 248] },
    styles: { fontSize: 8.5 },
    columnStyles: Object.fromEntries(reporte.columnas.map((c, i) => [i, { halign: esNumerica(c.formato) ? 'right' : 'left' }])),
    didParseCell: (d) => {
      if (d.section === 'head') d.cell.styles.halign = esNumerica(reporte.columnas[d.column.index].formato) ? 'right' : 'left'
    },
    margin: { left: margen, right: margen, bottom: 16 },
  })

  // Pie de página en todas las hojas
  const paginas = doc.getNumberOfPages()
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i)
    doc.setFontSize(7.5)
    doc.setTextColor(130)
    const alto = doc.internal.pageSize.getHeight()
    doc.text(`FashionStore SaaS · ${meta.empresa} · ${generado}`, margen, alto - 8)
    doc.text(`Página ${i} de ${paginas}`, ancho - margen, alto - 8, { align: 'right' })
  }
  doc.save(nombreArchivo(reporte, 'pdf'))
}

/**
 * Excel con ExcelJS (se carga solo al exportar): hoja "Reporte" con metadatos, tabla con formato
 * numérico real y el gráfico como imagen; hoja "Datos" con la tabla cruda para filtrar o
 * hacer tablas dinámicas.
 */
export async function exportarExcel({ reporte, consulta, narrativa, meta, grafico }: Contenido) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = `${meta.usuario} · ${meta.empresa}`
  wb.created = new Date()

  const formatos: Record<string, string> = { moneda: '"Bs" #,##0.00', numero: '#,##0', porcentaje: '0.0" %"' }
  const marca = 'FFAD3E68'
  const columnas = reporte.columnas
  const filas = reporte.filas.map(f => columnas.map(c => valorPlano(f[c.clave], c, reporte)))

  const escribirTabla = (ws: import('exceljs').Worksheet, filaInicio: number) => {
    const cab = ws.getRow(filaInicio)
    columnas.forEach((c, i) => {
      const celda = cab.getCell(i + 1)
      celda.value = c.etiqueta
      celda.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: marca } }
      celda.alignment = { horizontal: esNumerica(c.formato) ? 'right' : 'left' }
    })
    filas.forEach((valores, r) => {
      const fila = ws.getRow(filaInicio + 1 + r)
      valores.forEach((v, i) => {
        const celda = fila.getCell(i + 1)
        celda.value = v === '' ? null : v
        const fmt = formatos[columnas[i].formato]
        if (fmt) celda.numFmt = fmt
      })
    })
    ws.autoFilter = { from: { row: filaInicio, column: 1 }, to: { row: filaInicio + filas.length, column: columnas.length } }
    columnas.forEach((c, i) => {
      const largo = Math.max(c.etiqueta.length, ...reporte.filas.map(f => formatear(f[c.clave], c, reporte).length))
      ws.getColumn(i + 1).width = Math.min(45, Math.max(12, largo + 3))
    })
  }

  // Hoja "Reporte": metadatos + tabla + gráfico
  const ws = wb.addWorksheet('Reporte', { views: [{ showGridLines: false }] })
  ws.getCell('A1').value = reporte.titulo
  ws.getCell('A1').font = { bold: true, size: 16, color: { argb: marca } }
  const datos: [string, string][] = [
    ['Empresa', meta.empresa],
    ['Generado por', `${meta.usuario} (${meta.rol})`],
    ['Fecha y hora', ahora()],
    ['Pregunta', consulta],
    ['Resumen (IA)', narrativa ?? ''],
    ['Filtros', Object.entries(reporte.filtros).map(([k, v]) => `${k}: ${v}`).join(' · ')],
  ]
  datos.forEach(([k, v], i) => {
    const fila = 3 + i
    ws.getCell(`A${fila}`).value = k
    ws.getCell(`A${fila}`).font = { bold: true, color: { argb: 'FF555555' } }
    ws.mergeCells(fila, 2, fila, Math.max(2, columnas.length))
    ws.getCell(`B${fila}`).value = v
    ws.getCell(`B${fila}`).alignment = { wrapText: true, vertical: 'top' }
    if (k === 'Resumen (IA)' && v) ws.getRow(fila).height = Math.min(90, 15 * Math.ceil(v.length / 90))
  })
  const inicioTabla = 3 + datos.length + 1
  escribirTabla(ws, inicioTabla)
  if (grafico) {
    const id = wb.addImage({ base64: grafico.dataUrl, extension: 'png' })
    const anchoPx = Math.min(760, grafico.ancho)
    ws.addImage(id, {
      tl: { col: 0, row: inicioTabla + filas.length + 1 },
      ext: { width: anchoPx, height: (anchoPx * grafico.alto) / grafico.ancho },
    })
  }

  // Hoja "Datos": solo la tabla, para analizar
  escribirTabla(wb.addWorksheet('Datos'), 1)

  const buffer = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo(reporte, 'xlsx')
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
