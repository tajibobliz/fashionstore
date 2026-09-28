import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { VentaPorDia } from '../../../types/report'
import { CHART_PRIMARY, money } from './colors'

function fechaCorta(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit' })
}

export function SalesByDayChart({ data }: { data: VentaPorDia[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee5e9" />
        <XAxis dataKey="fecha" tickFormatter={fechaCorta} tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={value => money(Number(value))} width={90} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value: unknown) => [money(Number(value)), 'Monto']}
          labelFormatter={label => fechaCorta(String(label))}
        />
        <Line type="monotone" dataKey="monto" stroke={CHART_PRIMARY} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
