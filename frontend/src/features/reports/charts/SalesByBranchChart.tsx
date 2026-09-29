import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { VentaPorSucursal } from '../../../types/report'
import { CHART_PALETTE, CHART_PRIMARY, money } from './colors'

// Pastel con pocas sucursales (las etiquetas y la leyenda se leen bien); con muchas, se satura y unas
// barras se comparan mejor. 5 es el mismo límite que usa .cards para pasar a 2 columnas en tablet.
const PIE_THRESHOLD = 5

export function SalesByBranchChart({ data }: { data: VentaPorSucursal[] }) {
  if (data.length === 0) return null

  if (data.length <= PIE_THRESHOLD) {
    const total = data.reduce((sum, item) => sum + item.totalVendido, 0)
    return (
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            dataKey="totalVendido"
            nameKey="sucursal"
            cx="50%"
            cy="50%"
            outerRadius={95}
            label={(entry: { name?: string; value?: number }) => `${entry.name} (${total ? Math.round((Number(entry.value) / total) * 100) : 0}%)`}
          >
            {data.map((entry, index) => (
              <Cell key={entry.idSucursal} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value: unknown) => [money(Number(value)), 'Vendido']} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee5e9" />
        <XAxis dataKey="sucursal" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
        <YAxis tickFormatter={value => money(Number(value))} width={90} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(value: unknown) => [money(Number(value)), 'Vendido']} />
        <Bar dataKey="totalVendido" fill={CHART_PRIMARY} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
