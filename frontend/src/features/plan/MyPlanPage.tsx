import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, Minus, RefreshCw } from 'lucide-react'
import { saasApi } from '../../api/saas.api'
import type { CodigoPlan, PlanPublico } from '../../api/saas.api'
import { tenantApi } from '../../api/tenant.api'
import { getApiErrorMessage } from '../../utils/apiError'
import { useAuth } from '../../hooks/useAuth'
import { usePlan, PLAN_QUERY_KEY } from './usePlan'
import { formatoFecha } from './format'
import styles from './Plan.module.css'

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

  const cambiar = useMutation({
    mutationFn: (codigo: CodigoPlan) => tenantApi.cambiarPlan(codigo),
    onSuccess: data => {
      queryClient.setQueryData(PLAN_QUERY_KEY, data)
      void queryClient.invalidateQueries({ queryKey: ['tenant', 'historial'] })
      setConfirmar(null)
      setAviso(`Listo: tu empresa ahora tiene el plan ${data.plan?.nombre}, vigente hasta el ${formatoFecha(data.suscripcion.fechaVencimiento ?? '')}.`)
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
        </ul>
      </article>
      <article className={styles.box}>
        <h2 className={styles.boxTitle}>Uso de tu plan</h2>
        <Uso label="Sucursales activas" usados={d.limites.sucursales.usadas} maximo={d.limites.sucursales.maximo} />
        <Uso label="Empleados activos" usados={d.limites.usuarios.usados} maximo={d.limites.usuarios.maximo} />
        <p className={styles.muted}>Los clientes no cuentan para el límite.</p>
      </article>
    </div>

    <h2 className={styles.sectionTitle}>{esAdmin ? 'Cambiar o renovar' : 'Planes disponibles'}</h2>
    {!esAdmin && <p className={styles.muted}>Solo el administrador de la empresa puede cambiar el plan.</p>}
    {cambiar.isError && <p className={styles.error} role="alert">{getApiErrorMessage(cambiar.error)}</p>}
    <div className={styles.planGrid}>
      {planes.data?.map(p => {
        const esActual = p.codigo === actual
        return <article key={p.codigo} className={`${styles.planCard} ${esActual ? styles.planCurrent : ''}`}>
          <div className={styles.planTop}><h3>{p.nombre}</h3>{esActual && <span className={styles.tag}>Tu plan</span>}</div>
          <p className={styles.price}>Bs {p.precioReferencia.toLocaleString('es-BO')} <span>/ mes</span></p>
          <p className={styles.muted}>
            {p.maxSucursales == null ? 'Sucursales ilimitadas' : `${p.maxSucursales} sucursales`} · {p.maxUsuarios == null ? 'empleados ilimitados' : `${p.maxUsuarios} empleados`}
            {p.features.aiReports ? ' · IA' : ''}{p.features.ml ? ' · ML' : ''}
          </p>
          {esAdmin && (confirmar === p.codigo
            ? <div className={styles.confirm}>
              <p>¿Confirmas {esActual ? 'la renovación' : `el cambio a ${p.nombre}`}? La nueva vigencia empieza hoy.</p>
              <div>
                <button type="button" className={styles.btnPrimary} disabled={cambiar.isPending} onClick={() => cambiar.mutate(p.codigo)}>
                  {cambiar.isPending ? <><Loader2 size={15} className={styles.spin} /> Procesando…</> : 'Confirmar'}
                </button>
                <button type="button" className={styles.btnGhost} disabled={cambiar.isPending} onClick={() => setConfirmar(null)}>Cancelar</button>
              </div>
            </div>
            : <button type="button" className={esActual ? styles.btnGhost : styles.btnPrimary} onClick={() => { setAviso(''); cambiar.reset(); setConfirmar(p.codigo) }}>{accion(p)}</button>)}
        </article>
      })}
    </div>
    <p className={styles.muted}>Contratación simulada: el cambio se aplica al instante, sin cobro real. Si bajas de plan y ya superas un límite, no se borra nada; solo no podrás agregar más.</p>

    {esAdmin && <>
      <h2 className={styles.sectionTitle}>Historial de suscripciones</h2>
      {historial.data?.length ? <div className={styles.tableWrap}><table className={styles.table}>
        <thead><tr><th>Plan</th><th>Desde</th><th>Hasta</th><th>Estado</th></tr></thead>
        <tbody>{historial.data.map(h => <tr key={h.idSuscripcion}>
          <td>{h.plan.nombre}</td><td>{formatoFecha(h.fechaInicio)}</td><td>{formatoFecha(h.fechaVencimiento)}</td><td>{ESTADO[h.estado] ?? h.estado}</td>
        </tr>)}</tbody>
      </table></div> : <p className={styles.muted}>{historial.isLoading ? 'Cargando…' : 'Sin registros.'}</p>}
    </>}
  </section>
}
