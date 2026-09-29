import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DollarSign, Receipt, Ticket, CalendarClock, PackageX, FileSpreadsheet, FileText } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { reportsApi } from '../../api/reports.api'
import { queryKeys } from '../../api/queryKeys'
import { getApiErrorMessage } from '../../utils/apiError'
import type { DashboardReporte, TopProducto, VentaPorDia, VentaPorSucursal } from '../../types/report'
import dashboardStyles from '../dashboard/Dashboard.module.css'
import { SalesByDayChart } from './charts/SalesByDayChart'
import { TopProductsChart } from './charts/TopProductsChart'
import { SalesByBranchChart } from './charts/SalesByBranchChart'
import { buildExcelReport } from './export/buildExcelReport'
import { buildPdfReport } from './export/buildPdfReport'

type Rango = 'hoy' | '7d' | '30d' | 'anio'
const RANGOS: { id: Rango; label: string }[] = [
  { id: 'hoy', label: 'Hoy' },
  { id: '7d', label: 'Últimos 7 días' },
  { id: '30d', label: 'Últimos 30 días' },
  { id: 'anio', label: 'Este año' },
]

// El backend no filtra por fecha si no se envía desde/hasta (devuelve el histórico completo), así que
// cada rango arma su propio par de fechas ISO en vez de dejar que el endpoint use un valor por defecto.
function rangoAFechas(rango: Rango): { desde: string; hasta: string } {
  const hasta = new Date()
  const desde = new Date()
  if (rango === 'hoy') desde.setHours(0, 0, 0, 0)
  else if (rango === '7d') desde.setDate(desde.getDate() - 7)
  else if (rango === '30d') desde.setDate(desde.getDate() - 30)
  else { desde.setMonth(0, 1); desde.setHours(0, 0, 0, 0) }
  return { desde: desde.toISOString(), hasta: hasta.toISOString() }
}

function money(value: number | undefined) {
  return `Bs ${Number(value ?? 0).toFixed(2)}`
}

export default function ReportsPage() {
  const [rango, setRango] = useState<Rango>('7d')
  const filtros = useMemo(() => rangoAFechas(rango), [rango])
  const rangoLabel = RANGOS.find(item => item.id === rango)?.label ?? ''

  const dashboard = useQuery({
    queryKey: queryKeys.reports.dashboard(filtros),
    queryFn: () => reportsApi.dashboard(filtros) as Promise<DashboardReporte>,
  })
  const ventasPorDia = useQuery({
    queryKey: queryKeys.reports.salesByDay(filtros),
    queryFn: () => reportsApi.salesByDay(filtros) as Promise<VentaPorDia[]>,
  })
  const topProductos = useQuery({
    queryKey: queryKeys.reports.topProducts({ ...filtros, limit: 10 }),
    queryFn: () => reportsApi.topProducts({ ...filtros, limit: 10 }) as Promise<TopProducto[]>,
  })
  const ventasPorSucursal = useQuery({
    queryKey: queryKeys.reports.byBranch(filtros),
    queryFn: () => reportsApi.byBranch(filtros) as Promise<VentaPorSucursal[]>,
  })

  const cargandoAlgo = dashboard.isLoading || ventasPorDia.isLoading || topProductos.isLoading || ventasPorSucursal.isLoading
  const datosExport = () => ({
    rangoLabel,
    kpis: kpis.map(({ label, value }) => ({ label, value })),
    ventasPorDia: ventasPorDia.data ?? [],
    topProductos: topProductos.data ?? [],
    ventasPorSucursal: ventasPorSucursal.data ?? [],
  })

  const kpis: { label: string; value: string; icon: LucideIcon }[] = dashboard.data
    ? [
        { label: 'Ventas del período', value: money(dashboard.data.totalVentas), icon: DollarSign },
        { label: 'Cantidad de ventas', value: String(dashboard.data.cantidadVentas), icon: Receipt },
        { label: 'Ticket promedio', value: money(dashboard.data.ticketPromedio), icon: Ticket },
        { label: 'Reservas pendientes', value: String(dashboard.data.reservasPendientes), icon: CalendarClock },
        { label: 'Stock crítico', value: String(dashboard.data.stockCritico), icon: PackageX },
      ]
    : []

  return (
    <section className={dashboardStyles.content}>
      <div className={dashboardStyles.pageHeading}>
        <div>
          <p className={dashboardStyles.kicker}>Administración del sistema</p>
          <h1>Reportes y análisis</h1>
          <p>Indicadores generales de ventas, reservas e inventario.</p>
        </div>
      </div>

      <div className={dashboardStyles.sectionHeading}>
        <div>
          <h2>Rango del período</h2>
          {/* TODO: reservasPendientes y stockCritico son siempre "ahora mismo" en el backend (no
              filtran por fecha), así que estas dos tarjetas no cambian al mover el rango. */}
          <p>Ajusta el rango para las tarjetas de ventas; reservas y stock son siempre el estado actual.</p>
        </div>
      </div>
      <div className={dashboardStyles.rowActions} style={{ marginBottom: 20, justifyContent: 'space-between' }}>
        <div className={dashboardStyles.rowActions}>
          {RANGOS.map(item => (
            <button
              key={item.id}
              type="button"
              className={item.id === rango ? 'primary-button' : undefined}
              onClick={() => setRango(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className={dashboardStyles.rowActions}>
          <button type="button" disabled={cargandoAlgo} onClick={() => buildExcelReport(datosExport())}>
            <FileSpreadsheet size={16} aria-hidden="true" /> Descargar Excel
          </button>
          <button type="button" disabled={cargandoAlgo} onClick={() => buildPdfReport(datosExport())}>
            <FileText size={16} aria-hidden="true" /> Descargar PDF
          </button>
        </div>
      </div>

      {dashboard.isLoading ? (
        <div className={dashboardStyles.cards}>
          {Array.from({ length: 5 }).map((_, index) => (
            <article className={dashboardStyles.card} key={index}>
              <span className={dashboardStyles.metricIcon} style={{ opacity: 0.4 }}>
                <DollarSign size={24} />
              </span>
              <div>
                <span className={dashboardStyles.cardValue}>…</span>
                <span className={dashboardStyles.cardLabel}>Cargando</span>
              </div>
            </article>
          ))}
        </div>
      ) : dashboard.error ? (
        <p className={dashboardStyles.errorNotice} role="alert">{getApiErrorMessage(dashboard.error)}</p>
      ) : (
        <div className={dashboardStyles.cards}>
          {kpis.map(kpi => (
            <article className={dashboardStyles.card} key={kpi.label}>
              <span className={dashboardStyles.metricIcon}>
                <kpi.icon size={24} />
              </span>
              <div>
                <span className={dashboardStyles.cardValue}>{kpi.value}</span>
                <span className={dashboardStyles.cardLabel}>{kpi.label}</span>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className={dashboardStyles.sectionHeading} style={{ marginTop: 28 }}>
        <div>
          <h2>Ventas por día</h2>
          <p>{rangoLabel}</p>
        </div>
      </div>
      <article className={dashboardStyles.chartCard} style={{ marginBottom: 20 }}>
        {ventasPorDia.isLoading ? (
          <div className={dashboardStyles.chartLoading}>Cargando gráfico…</div>
        ) : ventasPorDia.error ? (
          <p className={dashboardStyles.errorNotice} role="alert">{getApiErrorMessage(ventasPorDia.error)}</p>
        ) : ventasPorDia.data?.length ? (
          <SalesByDayChart data={ventasPorDia.data} />
        ) : (
          <div className={dashboardStyles.chartLoading}>Sin ventas en este período.</div>
        )}
      </article>

      <div className={dashboardStyles.chartsGrid}>
        <article className={dashboardStyles.chartCard}>
          <div className={dashboardStyles.chartTitleRow}>
            <h3>Top productos</h3>
          </div>
          {topProductos.isLoading ? (
            <div className={dashboardStyles.chartLoading}>Cargando gráfico…</div>
          ) : topProductos.error ? (
            <p className={dashboardStyles.errorNotice} role="alert">{getApiErrorMessage(topProductos.error)}</p>
          ) : topProductos.data?.length ? (
            <TopProductsChart data={topProductos.data} />
          ) : (
            <div className={dashboardStyles.chartLoading}>Sin ventas en este período.</div>
          )}
        </article>

        <article className={dashboardStyles.chartCard}>
          <div className={dashboardStyles.chartTitleRow}>
            <h3>Ventas por sucursal</h3>
          </div>
          {ventasPorSucursal.isLoading ? (
            <div className={dashboardStyles.chartLoading}>Cargando gráfico…</div>
          ) : ventasPorSucursal.error ? (
            <p className={dashboardStyles.errorNotice} role="alert">{getApiErrorMessage(ventasPorSucursal.error)}</p>
          ) : ventasPorSucursal.data?.length ? (
            <SalesByBranchChart data={ventasPorSucursal.data} />
          ) : (
            <div className={dashboardStyles.chartLoading}>Sin ventas en este período.</div>
          )}
        </article>
      </div>
    </section>
  )
}
