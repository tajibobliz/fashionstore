import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ReporteIa } from '../../api/aiReports.api'
import { CHART_PALETTE, CHART_PRIMARY } from '../reports/charts/colors'
import { formatear } from './formato'

/**
 * Dibuja el gráfico que indicó el backend (`grafico.tipo`, eje x y series y).
 * El tipo lo decide la herramienta, no el modelo: línea para tendencias, barras para
 * comparar y torta para proporciones.
 */
export function ReporteIaChart({ reporte }: { reporte: ReporteIa }) {
  const g = reporte.grafico
  if (!g || reporte.filas.length === 0) return null
  const colX = reporte.columnas.find(c => c.clave === g.x)
  const colY = reporte.columnas.find(c => c.clave === g.y[0])
  if (!colX || !colY) return null

  const datos = reporte.filas.slice(0, 30).map(f => ({
    etiqueta: formatear(f[g.x], colX, reporte),
    valor: Number(f[g.y[0]] ?? 0),
  }))
  const fmt = (v: unknown) => formatear(Number(v), colY, reporte)
  const tooltip = <Tooltip formatter={(v: unknown) => [fmt(v), colY.etiqueta]} />

  if (g.tipo === 'torta' && datos.length <= 8) {
    const total = datos.reduce((s, d) => s + d.valor, 0)
    return (
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={datos} dataKey="valor" nameKey="etiqueta" cx="50%" cy="50%" outerRadius={95}
            label={(e: { name?: string; value?: number }) => (total ? `${Math.round((Number(e.value) / total) * 100)}%` : '')}>
            {datos.map((d, i) => <Cell key={d.etiqueta} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
          </Pie>
          {tooltip}
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  if (g.tipo === 'linea') {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={datos} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee5e9" />
          <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} minTickGap={12} />
          <YAxis tickFormatter={fmt} width={96} tick={{ fontSize: 11 }} />
          {tooltip}
          <Line type="monotone" dataKey="valor" stroke={CHART_PRIMARY} strokeWidth={2} dot={datos.length <= 31} />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={datos} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee5e9" />
        <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={70} />
        <YAxis tickFormatter={fmt} width={96} tick={{ fontSize: 11 }} />
        {tooltip}
        <Bar dataKey="valor" fill={CHART_PRIMARY} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
