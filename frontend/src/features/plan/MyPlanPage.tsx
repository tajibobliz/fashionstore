import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, Minus, RefreshCw } from 'lucide-react'
import { saasApi } from '../../api/saas.api'
import type { CodigoPlan, PlanPublico } from '../../api/saas.api'
import { tenantApi } from '../../api/tenant.api'
import { billingApi, irAPagar } from '../../api/billing.api'
import { getApiErrorMessage } from '../../utils/apiError'
import { useAuth } from '../../hooks/useAuth'
import { usePlan, PLAN_QUERY_KEY } from './usePlan'
import { formatoFecha } from './format'
import styles from './Plan.module.css'
import { formatPlanPrice, moneda } from '../../utils/money'
import { authSession } from '../auth/session'

function Uso({ label, usados, maximo }: { label: string; usados: number; maximo: number | null }) {
  const pct = maximo ? Math.min(100, Math.round((usados / maximo) * 100)) : 0
  const lleno = maximo != null && usados >= maximo
  return <div className={styles.usage}>
    <div className={styles.usageHead}><span>{label}</span><strong>{usados} {maximo == null ? '· ilimitado' : `de ${maximo}`}</strong></div>
    {maximo != null && <div className={styles.meter} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={maximo} aria-valuenow={usados}>
      <div className={lleno ? styles.meterFull : ''} style={{ width: `${pct}%` }} />
    </div>}
    {lleno && <p className={styles.usageNote}>Llegaste al límite de tu plan. Para agregar más, cambia a un plan superior.</p>}
  </div>
}

const ESTADO_PAGO: Record<string, string> = { PAGADO: 'Pagado', PENDIENTE: 'Pendiente', CANCELADO: 'Cancelado', EXPIRADO: 'Expirado' }
const ESTADO: Record<string, string> = { ACTIVA: 'Activa', VENCIDA: 'Vencida', CANCELADA: 'Reemplazada', SIN_SUSCRIPCION: 'Sin suscripción' }

/** Sección "Mi plan": plan actual, vigencia, uso vs. límites, cambio/renovación e historial. */
export default function MyPlanPage() {
  const { user } = useAuth()
  const esAdmin = user?.rol === 'ADMIN'
  const queryClient = useQueryClient()
  const plan = usePlan()
  const planes = useQuery({ queryKey: ['saas', 'planes'], queryFn: saasApi.planes, staleTime: 5 * 60_000 })
  const historial = useQuery({ queryKey: ['tenant', 'historial'], queryFn: tenantApi.historial, enabled: esAdmin })
  const [confirmar, setConfirmar] = useState<CodigoPlan | null>(null)
  const [aviso, setAviso] = useState('')
  const [historialCompleto, setHistorialCompleto] = useState(false)

  const [meses, setMeses] = useState(1)
  const pagos = useQuery({ queryKey: ['billing', 'pagos'], queryFn: billingApi.historial, enabled: esAdmin })
  // Cambiar o renovar = pagar: se va a la página de pago (Stripe) y el plan se activa al confirmarse.
  const cambiar = useMutation({
    mutationFn: (codigo: CodigoPlan) => billingApi.checkout(codigo, meses),
    onSuccess: checkout => {
      if (irAPagar(checkout)) return
      void queryClient.invalidateQueries({ queryKey: PLAN_QUERY_KEY })
      setConfirmar(null)
      setAviso('Listo: el plan quedó activo.')
    },
  })

  if (plan.isLoading) return <section className={styles.page}><p role="status">Cargando tu plan…</p></section>
  if (plan.isError || !plan.data) return <section className={styles.page}><p role="alert">No se pudo cargar tu plan. {getApiErrorMessage(plan.error)}</p><button type="button" className={styles.btnGhost} onClick={() => plan.refetch()}><RefreshCw size={15} /> Reintentar</button></section>

  const d = plan.data
  const actual = d.plan?.codigo
  const vencida = d.suscripcion.estado !== 'ACTIVA'

  const accion = (p: PlanPublico) => {
    if (p.codigo !== actual) return `Cambiar a ${p.nombre}`
    return vencida ? 'Renovar' : 'Renovar 1 mes más'
  }

  return <section className={styles.page}>
    <header className={styles.head}>
      <p className={styles.kicker}>{d.empresa.nombre} · /t/{d.empresa.slug}</p>
      <h1>Mi plan</h1>
    </header>

    {aviso && <p className={styles.success} role="status">{aviso}</p>}

    <div className={styles.summary}>
      <article className={styles.box}>
        <span className={`${styles.state} ${vencida ? styles.stateBad : styles.stateOk}`}>{ESTADO[d.suscripcion.estado]}</span>
        <h2>{d.plan?.nombre ?? 'Sin plan'}</h2>
        {d.suscripcion.fechaVencimiento && <p className={styles.muted}>
          {vencida ? 'Venció el' : 'Vigente hasta el'} {formatoFecha(d.suscripcion.fechaVencimiento)}
          {!vencida && d.suscripcion.diasRestantes != null && ` · ${d.suscripcion.diasRestantes} ${d.suscripcion.diasRestantes === 1 ? 'día' : 'días'} restantes`}
        </p>}
        <ul className={styles.features}>
          <li className={d.plan?.features.aiReports ? '' : styles.off}>{d.plan?.features.aiReports ? <Check size={15} /> : <Minus size={15} />} Reportes con IA y por voz</li>
          <li className={d.plan?.features.ml ? '' : styles.off}>{d.plan?.features.ml ? <Check size={15} /> : <Minus size={15} />} Analítica con Machine Learning</li>
          <li className={d.plan?.features.pagosOnline ? '' : styles.off}>{d.plan?.features.pagosOnline ? <Check size={15} /> : <Minus size={15} />} Pago diferido de pedidos hechos sin conexión</li>
        </ul>
      </article>
      <article className={styles.box}>
        <h2 className={styles.boxTitle}>Uso de tu plan</h2>
        <Uso label="Sucursales activas" usados={d.limites.sucursales.usadas} maximo={d.limites.sucursales.maximo} />
        <Uso label="Empleados activos" usados={d.limites.usuarios.usados} maximo={d.limites.usuarios.maximo} />
        <p className={styles.muted}>Los clientes no cuentan para el límite.</p>
      </article>
      <MonedaTienda actual={d.empresa.moneda ?? 'BOB'} esAdmin={esAdmin} />
    </div>

    <h2 className={styles.sectionTitle}>{esAdmin ? 'Cambiar o renovar' : 'Planes disponibles'}</h2>
    {!esAdmin && <p className={styles.muted}>Solo el administrador de la empresa puede cambiar el plan.</p>}
    {cambiar.isError && <p className={styles.error} role="alert">{getApiErrorMessage(cambiar.error)}</p>}
    <div className={styles.planGrid}>
      {planes.data?.map(p => {
        const esActual = p.codigo === actual
        return <article key={p.codigo} className={`${styles.planCard} ${esActual ? styles.planCurrent : ''}`}>
          <div className={styles.planTop}><h3>{p.nombre}</h3>{esActual && <span className={styles.tag}>Tu plan</span>}</div>
          <p className={styles.price}>{formatPlanPrice(p.precioReferencia)} <span>/ mes</span></p>
          <p className={styles.muted}>
            {p.maxSucursales == null ? 'Sucursales ilimitadas' : `${p.maxSucursales} sucursales`} · {p.maxUsuarios == null ? 'empleados ilimitados' : `${p.maxUsuarios} empleados`}
            {p.features.aiReports ? ' · IA' : ''}{p.features.ml ? ' · ML' : ''}{p.features.pagosOnline ? ' · Pago diferido offline' : ''}
          </p>
          {esAdmin && (confirmar === p.codigo
            ? <div className={styles.confirm}>
              <p>{esActual && !vencida ? `Renovar ${p.nombre}: los meses se suman a tu vencimiento actual.` : `Cambiar a ${p.nombre}: la nueva vigencia empieza hoy.`}</p>
              <label className={styles.field}>Meses
                <select value={meses} onChange={e => setMeses(Number(e.target.value))} disabled={cambiar.isPending}>
                  {[1, 3, 6, 12].map(n => <option key={n} value={n}>{n} {n === 1 ? 'mes' : 'meses'} · {formatPlanPrice(p.precioReferencia * n)}</option>)}
                </select>
              </label>
              <div>
                <button type="button" className={styles.btnPrimary} disabled={cambiar.isPending} onClick={() => cambiar.mutate(p.codigo)}>
                  {cambiar.isPending ? <><Loader2 size={15} className={styles.spin} /> Abriendo el pago…</> : `Pagar ${formatPlanPrice(p.precioReferencia * meses)}`}
                </button>
                <button type="button" className={styles.btnGhost} disabled={cambiar.isPending} onClick={() => setConfirmar(null)}>Cancelar</button>
              </div>
            </div>
            : <button type="button" className={esActual ? styles.btnGhost : styles.btnPrimary} onClick={() => { setAviso(''); cambiar.reset(); setMeses(1); setConfirmar(p.codigo) }}>{accion(p)}</button>)}
        </article>
      })}
    </div>
    <p className={styles.muted}>Los planes se cobran en dólares (USD), la moneda de la plataforma en todos los países. El pago se hace con tarjeta en la página segura de Stripe (modo de prueba: tarjeta 4242 4242 4242 4242, sin cobro real) y el plan se activa al confirmarse. Si bajas de plan y ya superas un límite, no se borra nada; solo no podrás agregar más.</p>

    {esAdmin && <>
      <h2 className={styles.sectionTitle}>Pagos</h2>
      {pagos.data?.length ? <div className={styles.tableWrap}><table className={styles.table}>
        <thead><tr><th>Fecha</th><th>Plan</th><th>Meses</th><th>Monto</th><th>Estado</th></tr></thead>
        <tbody>{pagos.data.slice(0, 10).map(x => <tr key={x.referencia}>
          <td>{formatoFecha(x.pagadoEn ?? x.creadoEn)}</td><td>{x.nombrePlan}</td><td>{x.meses}</td><td>{formatPlanPrice(x.monto)}</td>
          <td><span className={`${styles.pago} ${styles[`pago${x.estado}`] ?? ''}`}>{ESTADO_PAGO[x.estado]}</span>{x.proveedor === 'SIMULADO' ? <small className={styles.muted}> · simulado</small> : null}</td>
        </tr>)}</tbody>
      </table></div> : <p className={styles.muted}>{pagos.isLoading ? 'Cargando…' : 'Todavía no hay pagos.'}</p>}

      <h2 className={styles.sectionTitle}>Historial de suscripciones</h2>
      {historial.data?.length ? <div className={styles.tableWrap}><table className={styles.table}>
        <thead><tr><th>Plan</th><th>Desde</th><th>Hasta</th><th>Estado</th></tr></thead>
        <tbody>{(historialCompleto ? historial.data : historial.data.slice(0, 10)).map(h => <tr key={h.idSuscripcion}>
          <td>{h.plan.nombre}</td><td>{formatoFecha(h.fechaInicio)}</td><td>{formatoFecha(h.fechaVencimiento)}</td><td>{ESTADO[h.estado] ?? h.estado}</td>
        </tr>)}</tbody>
      </table></div> : <p className={styles.muted}>{historial.isLoading ? 'Cargando…' : 'Sin registros.'}</p>}
      {(historial.data?.length ?? 0) > 10 && <button type="button" className={styles.btnGhost} onClick={() => setHistorialCompleto(v => !v)}>
        {historialCompleto ? 'Ver solo los últimos 10' : `Ver todo (${historial.data!.length})`}
      </button>}
    </>}
  </section>
}

/**
 * Moneda en la que vende la tienda. Los planes se pagan en USD, pero los precios, ventas y
 * reportes de la tienda usan esta moneda. Cambiarla no convierte los precios ya cargados.
 */
function MonedaTienda({ actual, esAdmin }: { actual: string; esAdmin: boolean }) {
  const queryClient = useQueryClient()
  const monedas = useQuery({ queryKey: ['saas', 'monedas'], queryFn: saasApi.monedas, staleTime: Infinity, enabled: esAdmin })
  const [elegida, setElegida] = useState(actual)
  const [aviso, setAviso] = useState('')
  const guardar = useMutation({
    mutationFn: () => tenantApi.cambiarMoneda(elegida),
    onSuccess: ({ moneda: codigo }) => {
      // La sesión guarda la empresa: se actualiza para que toda la app use la moneda nueva.
      const { user } = authSession.getSnapshot()
      const token = authSession.getToken()
      if (user?.empresa && token) authSession.set(token, { ...user, empresa: { ...user.empresa, moneda: codigo } })
      void queryClient.invalidateQueries()
      setAviso(`Listo: tu tienda ahora muestra y cobra en ${moneda(codigo).nombre} (${moneda(codigo).simbolo}).`)
    },
  })
  const m = moneda(actual)

  return <article className={styles.box}>
    <h2 className={styles.boxTitle}>Moneda de tu tienda</h2>
    <p className={styles.currency}><strong>{m.simbolo}</strong> {m.nombre} <span className={styles.muted}>({m.codigo})</span></p>
    {esAdmin ? <>
      <label className={styles.field}>Cambiar a
        <select value={elegida} onChange={e => { setElegida(e.target.value); setAviso(''); guardar.reset() }}>
          {(monedas.data ?? [{ codigo: actual, nombre: m.nombre, simbolo: m.simbolo }]).map(x => <option key={x.codigo} value={x.codigo}>{x.simbolo} · {x.nombre} ({x.codigo})</option>)}
        </select>
      </label>
      {elegida !== actual && <p className={styles.usageNote}>Ojo: no se convierten los precios. Revisa los precios de tu catálogo después del cambio.</p>}
      {guardar.isError && <p className={styles.error} role="alert">{getApiErrorMessage(guardar.error)}</p>}
      {aviso && <p className={styles.success} role="status">{aviso}</p>}
      <button type="button" className={styles.btnPrimary} disabled={elegida === actual || guardar.isPending} onClick={() => guardar.mutate()}>
        {guardar.isPending ? 'Guardando…' : 'Guardar moneda'}
      </button>
    </> : <p className={styles.muted}>Solo el administrador puede cambiarla.</p>}
  </article>
}
