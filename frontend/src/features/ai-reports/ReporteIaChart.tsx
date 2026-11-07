import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ReporteIa } from '../../api/aiReports.api'
import { CHART_PALETTE } from '../reports/charts/colors'
import { COLORES_SERIES, formatear } from './formato'

/**
 * Dibuja el gráfico que indicó el backend (`grafico.tipo`, eje x y series y).
 * El tipo lo decide la herramienta, no el modelo: línea para tendencias, barras para
 * comparar (una o varias series) y torta para proporciones.
 */
export function ReporteIaChart({ reporte }: { reporte: ReporteIa }) {
  const g = reporte.grafico
  if (!g || reporte.filas.length === 0) return null
  const colX = reporte.columnas.find(c => c.clave === g.x)
  const series = g.y.map(clave => reporte.columnas.find(c => c.clave === clave)).filter(c => c !== undefined)
  if (!colX || series.length === 0) return null
  const colY = series[0]

  const datos = reporte.filas.slice(0, 30).map(f => ({
    etiqueta: formatear(f[g.x], colX, reporte),
    ...Object.fromEntries(series.map(c => [c.clave, Number(f[c.clave] ?? 0)])),
  })) as Record<string, string | number>[]
  const fmt = (v: unknown) => formatear(Number(v), colY, reporte)
  const nombre = (clave: unknown) => series.find(c => c.clave === clave)?.etiqueta ?? String(clave)
  const tooltip = <Tooltip formatter={(v: unknown, n: unknown) => [formatear(Number(v), series.find(c => c.clave === n) ?? colY, reporte), nombre(n)]} />

  if (g.tipo === 'torta' && series.length === 1 && datos.length <= 8) {
    const total = datos.reduce((s, d) => s + Number(d[colY.clave]), 0)
    return (
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={datos} dataKey={colY.clave} nameKey="etiqueta" cx="50%" cy="50%" outerRadius={95} isAnimationActive={false}
            label={(e: { value?: number }) => (total ? `${Math.round((Number(e.value) / total) * 100)}%` : '')}>
            {datos.map((d, i) => <Cell key={String(d.etiqueta)} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
          </Pie>
          <Tooltip formatter={(v: unknown) => [fmt(v), colY.etiqueta]} />
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
          {series.map((c, i) => (
            <Line key={c.clave} type="linear" dataKey={c.clave} stroke={COLORES_SERIES[i % COLORES_SERIES.length]} strokeWidth={2} dot={datos.length <= 31} isAnimationActive={false} />
          ))}
          {series.length > 1 && <Legend formatter={nombre} />}
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
        {series.map((c, i) => (
          <Bar key={c.clave} dataKey={c.clave} fill={COLORES_SERIES[i % COLORES_SERIES.length]} radius={[6, 6, 0, 0]} isAnimationActive={false} />
        ))}
        {series.length > 1 && <Legend formatter={nombre} verticalAlign="top" height={28} />}
      </BarChart>
    </ResponsiveContainer>
  )
}
