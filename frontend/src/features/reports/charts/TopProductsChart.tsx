import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TopProducto } from '../../../types/report'
import { CHART_PRIMARY } from './colors'

const MAX_CHARS_ETIQUETA = 14

// recharts invoca tickFormatter(value, index): un segundo parámetro por defecto aquí choca con ese
// índice (0, 1, 2...) y pisa el límite de caracteres, así que max queda fijo y no se recibe por argumento.
function truncar(value: string) {
  return value.length > MAX_CHARS_ETIQUETA ? `${value.slice(0, MAX_CHARS_ETIQUETA - 1)}…` : value
}

export function TopProductsChart({ data }: { data: TopProducto[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee5e9" />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
        <YAxis dataKey="nombre" type="category" tickFormatter={truncar} width={110} interval={0} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(value: unknown) => [Number(value), 'Unidades vendidas']} labelFormatter={label => String(label)} />
        <Bar dataKey="cantidadVendida" fill={CHART_PRIMARY} radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
