/**
 * Convierte el gráfico (SVG de recharts) que está en pantalla en una imagen PNG para
 * incluirla en el PDF y en el Excel. La leyenda de recharts es HTML (no está en el SVG),
 * así que se dibuja aparte en el lienzo.
 */
export interface ImagenGrafico { dataUrl: string; ancho: number; alto: number }

export async function graficoComoImagen(
  contenedor: HTMLElement | null,
  leyenda: { nombre: string; color: string }[] = [],
): Promise<ImagenGrafico | null> {
  // Los íconos de la leyenda de recharts también son `svg.recharts-surface` (14×14):
  // se descartan y se toma el SVG más grande, que es el gráfico.
  const candidatos = Array.from(contenedor?.querySelectorAll<SVGSVGElement>('svg.recharts-surface') ?? [])
    .filter(s => !s.closest('.recharts-legend-wrapper'))
  const area = (s: SVGSVGElement) => { const r = s.getBoundingClientRect(); return r.width * r.height }
  const svg = candidatos.sort((a, b) => area(b) - area(a))[0]
  if (!svg) return null
  const { width, height } = svg.getBoundingClientRect()
  if (width < 100 || height < 60) return null

  const copia = svg.cloneNode(true) as SVGSVGElement
  copia.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  copia.setAttribute('width', String(width))
  copia.setAttribute('height', String(height))
  // Fuera de la página el SVG no hereda la tipografía: se le pone la misma de la pantalla.
  copia.setAttribute('font-family', getComputedStyle(svg).fontFamily || 'sans-serif')
  const texto = new XMLSerializer().serializeToString(copia)
  const url = URL.createObjectURL(new Blob([texto], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const img = await new Promise<HTMLImageElement>((ok, mal) => {
      const i = new Image()
      i.onload = () => ok(i)
      i.onerror = () => mal(new Error('No se pudo convertir el gráfico'))
      i.src = url
    })
    const escala = 2
    const altoLeyenda = leyenda.length ? 28 : 0
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * escala)
    canvas.height = Math.round((height + altoLeyenda) * escala)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.scale(escala, escala)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height + altoLeyenda)
    if (leyenda.length) {
      ctx.font = '12px sans-serif'
      ctx.textBaseline = 'middle'
      let x = 8
      for (const l of leyenda) {
        ctx.fillStyle = l.color
        ctx.fillRect(x, 10, 12, 12)
        ctx.fillStyle = '#374151'
        ctx.fillText(l.nombre, x + 18, 16)
        x += 18 + ctx.measureText(l.nombre).width + 18
      }
    }
    ctx.drawImage(img, 0, altoLeyenda, width, height)
    return { dataUrl: canvas.toDataURL('image/png'), ancho: width, alto: height + altoLeyenda }
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}
