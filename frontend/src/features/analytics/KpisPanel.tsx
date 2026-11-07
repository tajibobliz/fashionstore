import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, CalendarCheck, CloudOff, Package, RefreshCw, Repeat, RotateCcw, ShoppingBag, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Kpis } from '../../api/kpis.api'
import { getApiErrorMessage } from '../../utils/apiError'
import { CHART_PRIMARY } from '../reports/charts/colors'
import dashboardStyles from '../dashboard/Dashboard.module.css'
import { useKpis } from './useKpis'
import styles from './Analytics.module.css'
import { formatMoney, simboloMoneda } from '../../utils/money'

const entero = new Intl.NumberFormat('es-BO')
const hora = new Intl.DateTimeFormat('es-BO', { dateStyle: 'short', timeStyle: 'short' })
const fechaCorta = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`
const VENTANAS = [7, 30, 90, 365]

interface Props {
  /** Ruta base del dashboard del rol (p. ej. /dashboard/admin) y secciones que tiene, para el drill-down. */
  base: string
  secciones: Set<string>
}

/** Indicadores clave (CU12): tarjetas con drill-down, tendencia, cambios, devoluciones y top por sucursal. */
export function KpisPanel({ base, secciones }: Props) {
  const [idSucursal, setIdSucursal] = useState<number | undefined>()
  const [dias, setDias] = useState(30)
  const k = useKpis(idSucursal, dias)
  const d = k.datos
  const ir = (seccion: string) => (secciones.has(seccion) ? `${base}/${seccion}` : null)

  return (
    <div className={styles.stack}>
      <div className={`${dashboardStyles.panel} ${styles.toolbar}`}>
        {d && d.sucursales.length > 1 && (
          <label>
            Sucursal
            <select value={idSucursal ?? ''} onChange={e => setIdSucursal(e.target.value ? Number(e.target.value) : undefined)}>
              <option value="">Todas</option>
              {d.sucursales.map(s => <option key={s.idSucursal} value={s.idSucursal}>{s.nombre}</option>)}
            </select>
          </label>
        )}
        {d && d.sucursales.length === 1 && <p className={styles.scopeNote}>Sucursal: <strong>{d.sucursales[0].nombre}</strong></p>}
        <label>
          Tendencia y rankings
          <select value={dias} onChange={e => setDias(Number(e.target.value))}>
            {VENTANAS.map(v => <option key={v} value={v}>Últimos {v} días</option>)}
          </select>
        </label>
        <div className={styles.updated}>
          {d && <span>{k.desdeCache ? 'Copia guardada' : 'Actualizado'} {hora.format(new Date(d.generadoEn))} · se actualiza cada 5 min</span>}
          <button type="button" onClick={k.refrescar} disabled={k.actualizando} aria-label="Actualizar ahora" title="Actualizar ahora">
            <RefreshCw size={15} className={k.actualizando ? styles.spin : undefined} />
          </button>
        </div>
      </div>

      {k.desdeCache && d && (
        <p className={styles.offlineBanner} role="status">
          <CloudOff size={16} /> Sin conexión con el servidor. Datos actualizados al {hora.format(new Date(d.generadoEn))}.
        </p>
      )}
      {k.error && !d && <p className={dashboardStyles.errorNotice}>{getApiErrorMessage(k.error)}</p>}
      {k.cargando && <div className={dashboardStyles.chartLoading} role="status">Calculando indicadores…</div>}

      {d && <Contenido d={d} ir={ir} />}
    </div>
  )
}

function Contenido({ d, ir }: { d: Kpis; ir: (s: string) => string | null }) {
  const tasaDev = d.devoluciones.tasa
  const tasaCam = d.cambios.tasa
  return (
    <>
      <div className={styles.kpiGrid}>
        <Tarjeta icon={ShoppingBag} titulo="Ventas de hoy" valor={`${formatMoney(d.ventasHoy.monto)}`}
          detalle={`${d.ventasHoy.cantidad} ventas · ayer ${formatMoney(d.ventasHoy.ayer)}`} to={ir('reportes')} />
        <Tarjeta icon={Wallet} titulo="Ventas del mes" valor={`${formatMoney(d.ventasMes.monto)}`}
          detalle={`${d.ventasMes.cantidad} ventas · ${entero.format(d.ventasMes.unidades)} unidades`}
          variacion={d.ventasMes.variacion} variacionTexto="vs. mismo periodo del mes anterior" to={ir('reportes')} />
        <Tarjeta icon={ShoppingBag} titulo="Ticket promedio del mes" valor={`${formatMoney(d.ventasMes.ticketPromedio)}`}
          detalle={`Presencial ${formatMoney(d.ventasMes.presencial)} · Digital ${formatMoney(d.ventasMes.digital)}`} />
        <Tarjeta icon={Package} titulo="Stock crítico" valor={entero.format(d.stockCritico.variantes)}
          detalle={`variantes con ≤ ${d.stockCritico.umbral} unidades · ${d.stockCritico.agotadas} agotadas`}
          alerta={d.stockCritico.agotadas > 0} to={ir('inventario')} />
        <Tarjeta icon={CalendarCheck} titulo="Reservas pendientes" valor={entero.format(d.reservasPendientes)} detalle="por preparar o entregar" to={ir('reservas')} />
        <Tarjeta icon={RotateCcw} titulo="Tasa de devoluciones" valor={tasaDev === null ? '—' : `${tasaDev.toLocaleString('es-BO')} %`}
          detalle={`${d.devoluciones.unidadesDevueltas} de ${d.devoluciones.unidadesVendidas} unidades · ${d.dias} días`} to={ir('devoluciones')} />
        <Tarjeta icon={Repeat} titulo="Tasa de cambios" valor={tasaCam === null ? '—' : `${tasaCam.toLocaleString('es-BO')} %`}
          detalle={`${d.cambios.unidadesCambiadas} unidades en ${d.cambios.cambios} cambios · ${d.dias} días`} to={ir('cambios')} />
        <Tarjeta icon={AlertTriangle} titulo="Conflictos offline" valor={entero.format(d.conflictosAbiertos)} detalle="sin resolver"
          alerta={d.conflictosAbiertos > 0} to={ir('sincronizacion')} />
      </div>

      <section className={`${dashboardStyles.panel} ${styles.chartPanel}`}>
        <div className={styles.panelTitle}>
          <h2>Ventas por día</h2>
          <span>Últimos {d.dias} días{d.sucursal ? ` · ${d.sucursal}` : ''}</span>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={d.tendencia} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="kpiArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_PRIMARY} stopOpacity={0.35} />
                <stop offset="100%" stopColor={CHART_PRIMARY} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee5e9" vertical={false} />
            <XAxis dataKey="fecha" tickFormatter={fechaCorta} tick={{ fontSize: 11 }} minTickGap={18} />
            <YAxis tickFormatter={(v: number) => `${simboloMoneda()} ${entero.format(v)}`} width={86} tick={{ fontSize: 11 }} />
            <Tooltip labelFormatter={(f: unknown) => `Día ${String(f).split('-').reverse().join('/')}`}
              formatter={(v: unknown, n: unknown) => (n === 'monto' ? [`${formatMoney(Number(v))}`, 'Vendido'] : [String(v), String(n)])} />
            <Area type="linear" dataKey="monto" stroke={CHART_PRIMARY} strokeWidth={2} fill="url(#kpiArea)" />
          </AreaChart>
        </ResponsiveContainer>
      </section>

      <div className={styles.twoCols}>
        <Ranking titulo="Top 5 prendas más cambiadas" vacio="No hubo cambios en este periodo."
          filas={d.topCambiadas.map(x => ({ nombre: x.producto, valor: x.unidades, extra: `${x.cambios} cambios` }))} />
        <Ranking titulo="Prendas más devueltas" vacio="No hubo devoluciones en este periodo."
          filas={d.topDevueltas.map(x => ({ nombre: x.producto, valor: x.unidades }))} />
      </div>

      <section className={dashboardStyles.panel}>
        <div className={styles.panelTitle}>
          <h2>Prendas más vendidas por sucursal</h2>
          <span>Top 3 · últimos {d.dias} días</span>
        </div>
        {d.topPorSucursal.length === 0 ? <p className={styles.muted}>Sin ventas en este periodo.</p> : (
          <div className={styles.branchGrid}>
            {Object.entries(agrupar(d.topPorSucursal)).map(([sucursal, filas]) => (
              <div key={sucursal} className={styles.branchCard}>
                <h3>{sucursal}</h3>
                <ol>
                  {filas.map(f => (
                    <li key={f.producto}><span>{f.producto}</span><strong>{f.unidades} u.</strong><small>{formatMoney(f.monto)}</small></li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

function Tarjeta({ icon: Icon, titulo, valor, detalle, variacion, variacionTexto, alerta, to }: {
  icon: LucideIcon; titulo: string; valor: string; detalle: string; variacion?: number | null; variacionTexto?: string; alerta?: boolean; to?: string | null
}) {
  const contenido = (
    <>
      <span className={`${styles.kpiIcon} ${alerta ? styles.kpiIconAlert : ''}`}><Icon size={20} /></span>
      <span className={styles.kpiTitle}>{titulo}</span>
      <strong className={styles.kpiValue}>{valor}</strong>
      {variacion !== undefined && variacion !== null && (
        <span className={`${styles.trend} ${variacion >= 0 ? styles.up : styles.down}`} title={variacionTexto}>
          {variacion >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />} {variacion > 0 ? '+' : ''}{variacion.toLocaleString('es-BO')} %
        </span>
      )}
      <span className={styles.kpiDetail}>{detalle}</span>
    </>
  )
  return to
    ? <Link to={to} className={`${styles.kpi} ${styles.kpiLink}`} aria-label={`${titulo}: ${valor}. Ver detalle`}>{contenido}</Link>
    : <article className={styles.kpi}>{contenido}</article>
}

function Ranking({ titulo, filas, vacio }: { titulo: string; filas: { nombre: string; valor: number; extra?: string }[]; vacio: string }) {
  const max = Math.max(1, ...filas.map(f => f.valor))
  return (
    <section className={dashboardStyles.panel}>
      <div className={styles.panelTitle}><h2>{titulo}</h2><span>unidades</span></div>
      {filas.length === 0 ? <p className={styles.muted}>{vacio}</p> : (
        <ul className={styles.bars}>
          {filas.map(f => (
            <li key={f.nombre}>
              <span className={styles.barLabel}>{f.nombre}{f.extra && <small> · {f.extra}</small>}</span>
              <span className={styles.barTrack}><span style={{ width: `${(f.valor / max) * 100}%` }} /></span>
              <strong>{f.valor}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function agrupar(filas: Kpis['topPorSucursal']) {
  return filas.reduce<Record<string, Kpis['topPorSucursal']>>((acc, f) => {
    (acc[f.sucursal] ??= []).push(f)
    return acc
  }, {})
}
