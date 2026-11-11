import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, CreditCard, LayoutGrid, Loader2, Lock, XCircle } from 'lucide-react'
import { billingApi } from '../../api/billing.api'
import type { PagoSuscripcion } from '../../api/billing.api'
import { getApiErrorMessage } from '../../utils/apiError'
import { formatMoney } from '../../utils/money'
import { formatoFecha } from '../../features/plan/format'
import { PLAN_QUERY_KEY } from '../../features/plan/usePlan'
import { tenantApi } from '../../api/tenant.api'
import base from './ContratarPlan.module.css'
import styles from './PagoPages.module.css'

const MI_PLAN = '/dashboard/admin/mi-plan'
const usd = (n: number) => formatMoney(n, 'USD')
const detalle = (p: PagoSuscripcion) => `Plan ${p.nombrePlan} · ${p.meses} ${p.meses === 1 ? 'mes' : 'meses'} · ${usd(p.monto)}`

function Marco({ children }: { children: ReactNode }) {
  return <div className={base.page}>
    <header className={base.top}>
      <Link to="/" className={base.brand} aria-label="FashionCloud, inicio"><LayoutGrid size={20} aria-hidden="true" />Fashion<span>Cloud</span></Link>
    </header>
    <main className={`${base.main} ${styles.main}`}>{children}</main>
  </div>
}

/**
 * Vuelta desde Stripe con el pago hecho. La redirección no activa nada: esta página espera a
 * que el backend reciba la confirmación de Stripe (webhook) y entonces muestra el plan activo.
 */
export function PagoExito() {
  const [params] = useSearchParams()
  const ref = params.get('ref') ?? ''
  const client = useQueryClient()
  // Pasados 90 s sin confirmación se deja de consultar y se avisa.
  const [tarde, setTarde] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setTarde(true), 90_000)
    return () => clearTimeout(t)
  }, [])
  const pago = useQuery({
    queryKey: ['billing', 'pago', ref],
    queryFn: () => billingApi.pago(ref),
    enabled: !!ref,
    // Consulta cada 2 s mientras siga pendiente (hasta 90 s).
    refetchInterval: q => (q.state.data?.estado === 'PENDIENTE' && !tarde ? 2000 : false),
  })
  const plan = useQuery({ queryKey: PLAN_QUERY_KEY, queryFn: tenantApi.me, enabled: pago.data?.estado === 'PAGADO' })
  useEffect(() => {
    if (pago.data?.estado === 'PAGADO') void client.invalidateQueries({ queryKey: PLAN_QUERY_KEY })
  }, [pago.data?.estado, client])

  if (!ref) return <Marco><h1>Pago</h1><p className={base.lead}>Falta la referencia del pago.</p><Link className={base.submit} to={MI_PLAN}>Ir a Mi plan</Link></Marco>
  if (pago.isLoading) return <Marco><p role="status" className={styles.estado}><Loader2 className={base.spin} size={20} /> Consultando tu pago…</p></Marco>
  if (pago.error) return <Marco><h1>No encontramos el pago</h1><p className={base.error} role="alert">{getApiErrorMessage(pago.error)}</p><Link className={base.submit} to={MI_PLAN}>Ir a Mi plan</Link></Marco>

  const p = pago.data!
  if (p.estado === 'PAGADO') {
    const s = plan.data?.suscripcion
    return <Marco>
      <div className={`${styles.icono} ${styles.ok}`}><CheckCircle2 size={44} aria-hidden="true" /></div>
      <h1>¡Pago confirmado!</h1>
      <p className={base.lead}>{detalle(p)}</p>
      <div className={`${base.block} ${styles.resumen}`} role="status">
        <p><strong>Tu plan {p.nombrePlan} está activo</strong>{s?.fechaVencimiento ? ` hasta el ${formatoFecha(s.fechaVencimiento)}` : ''}.</p>
        <p className={base.help}>Referencia: {p.referencia}</p>
      </div>
      <Link className={base.submit} to="/dashboard/admin">Ir a mi panel</Link>
    </Marco>
  }
  if (p.estado === 'PENDIENTE') {
    return <Marco>
      <div className={styles.icono}><Loader2 className={base.spin} size={40} aria-hidden="true" /></div>
      <h1>Confirmando tu pago…</h1>
      <p className={base.lead}>{detalle(p)}</p>
      <p className={styles.estado} role="status">{tarde
        ? 'La confirmación está tardando más de lo normal. Si ya pagaste, tu plan se activará apenas llegue; puedes revisarlo en Mi plan.'
        : 'Stripe nos está avisando del resultado. Esto suele tardar unos segundos.'}</p>
      {tarde && <Link className={base.submit} to={MI_PLAN}>Ir a Mi plan</Link>}
    </Marco>
  }
  return <Marco>
    <div className={`${styles.icono} ${styles.bad}`}><XCircle size={44} aria-hidden="true" /></div>
    <h1>El pago no se completó</h1>
    <p className={base.lead}>{detalle(p)} · estado {p.estado.toLowerCase()}.</p>
    <Link className={base.submit} to={MI_PLAN}>Volver a intentar desde Mi plan</Link>
  </Marco>
}

/** Vuelta desde Stripe con "Volver" / cancelar: el pago pendiente queda cancelado. */
export function PagoCancelado() {
  const [params] = useSearchParams()
  const ref = params.get('ref') ?? ''
  const cancelar = useMutation({ mutationFn: () => billingApi.cancelar(ref) })
  const pedido = useRef(false)
  useEffect(() => {
    if (ref && !pedido.current) { pedido.current = true; cancelar.mutate() }
  }, [ref, cancelar])
  const p = cancelar.data
  return <Marco>
    <div className={`${styles.icono} ${styles.bad}`}><XCircle size={44} aria-hidden="true" /></div>
    <h1>{p?.estado === 'PAGADO' ? 'Este pago ya estaba confirmado' : 'Pago cancelado'}</h1>
    <p className={base.lead}>{p ? detalle(p) : 'No se realizó ningún cobro.'}</p>
    {p?.estado !== 'PAGADO' && <p className={styles.estado}>No se realizó ningún cobro. Tu empresa queda como estaba; puedes elegir un plan y pagar cuando quieras.</p>}
    {cancelar.error && <p className={base.error} role="alert">{getApiErrorMessage(cancelar.error)}</p>}
    <Link className={base.submit} to={MI_PLAN}>Ir a Mi plan</Link>
  </Marco>
}

/**
 * Pasarela SIMULADA: se usa cuando el backend no tiene claves de Stripe (o en las pruebas).
 * Imita la página de Stripe Checkout para poder demostrar el flujo sin internet; no cobra nada.
 */
export function PagoSimulado() {
  const [params] = useSearchParams()
  const ref = params.get('ref') ?? ''
  const navigate = useNavigate()
  const pago = useQuery({ queryKey: ['billing', 'pago', ref], queryFn: () => billingApi.pago(ref), enabled: !!ref })
  const [tarjeta, setTarjeta] = useState('4242 4242 4242 4242')
  const pagar = useMutation({
    mutationFn: () => billingApi.pagarSimulado(ref),
    onSuccess: () => navigate(`/pago/exito?ref=${encodeURIComponent(ref)}`, { replace: true }),
  })
  const rechazada = tarjeta.replace(/\s/g, '') === '4000000000000002'

  if (pago.isLoading) return <Marco><p role="status" className={styles.estado}><Loader2 className={base.spin} size={20} /> Cargando el pago…</p></Marco>
  if (pago.error || !pago.data) return <Marco><h1>Pago no encontrado</h1><p className={base.error} role="alert">{getApiErrorMessage(pago.error)}</p><Link className={base.submit} to={MI_PLAN}>Ir a Mi plan</Link></Marco>
  const p = pago.data
  if (p.estado !== 'PENDIENTE') return <Navigate to={`/pago/${p.estado === 'PAGADO' ? 'exito' : 'cancelado'}?ref=${encodeURIComponent(ref)}`} replace />

  return <Marco>
    <p className={styles.aviso}>Pasarela simulada · modo de prueba, no se cobra nada</p>
    <h1>Pagar suscripción</h1>
    <p className={base.lead}>FashionCloud · {detalle(p)}</p>
    <form className={`${base.block} ${styles.tarjeta}`} onSubmit={e => { e.preventDefault(); if (!rechazada) pagar.mutate() }}>
      <div className={styles.total}><span>Total a pagar</span><strong>{usd(p.monto)}</strong></div>
      <label className={base.field}>Número de tarjeta
        <span className={styles.conIcono}><CreditCard size={18} aria-hidden="true" /><input inputMode="numeric" autoComplete="off" value={tarjeta} onChange={e => setTarjeta(e.target.value)} /></span>
      </label>
      <div className={base.row}>
        <label className={base.field}>Vencimiento<input defaultValue="12 / 34" autoComplete="off" /></label>
        <label className={base.field}>CVC<input defaultValue="123" autoComplete="off" /></label>
      </div>
      <p className={base.help}>Tarjetas de prueba: 4242 4242 4242 4242 (aprobada) · 4000 0000 0000 0002 (rechazada).</p>
      {rechazada && <p className={base.error} role="alert">Tarjeta rechazada por el banco (simulado). Prueba con otra tarjeta.</p>}
      {pagar.error && <p className={base.error} role="alert">{getApiErrorMessage(pagar.error)}</p>}
      <button type="submit" className={base.submit} disabled={pagar.isPending || rechazada}>
        {pagar.isPending ? <><Loader2 size={18} className={base.spin} aria-hidden="true" /> Procesando…</> : <><Lock size={16} aria-hidden="true" /> Pagar {usd(p.monto)}</>}
      </button>
      <Link className={styles.cancelar} to={`/pago/cancelado?ref=${encodeURIComponent(ref)}`}>Cancelar y volver</Link>
    </form>
  </Marco>
}
