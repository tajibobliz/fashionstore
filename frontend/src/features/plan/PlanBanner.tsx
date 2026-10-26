import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Clock, Lock, X } from 'lucide-react'
import { usePlan, PLAN_QUERY_KEY } from './usePlan'
import { escucharRestricciones } from './planEvents'
import type { RestriccionPlan } from './planEvents'
import { formatoFecha } from './format'
import styles from './Plan.module.css'

const DIAS_AVISO = 7

/**
 * Avisos del plan en la parte superior del dashboard:
 * - suscripción vencida (solo lectura) o por vencer,
 * - la última restricción que devolvió el backend (límite alcanzado, función no incluida).
 */
export default function PlanBanner({ planPath }: { planPath: string | null }) {
  const { data } = usePlan()
  const queryClient = useQueryClient()
  const [restriccion, setRestriccion] = useState<RestriccionPlan | null>(null)

  useEffect(() => escucharRestricciones(r => {
    setRestriccion(r)
    void queryClient.invalidateQueries({ queryKey: PLAN_QUERY_KEY })
  }), [queryClient])

  const verPlan = planPath ? <Link to={planPath} className={styles.bannerLink}>Ver mi plan</Link> : null
  const s = data?.suscripcion

  return <div className={styles.bannerStack}>
    {s?.estado === 'VENCIDA' && <div className={`${styles.banner} ${styles.bannerDanger}`} role="alert">
      <Lock size={18} aria-hidden="true" />
      <p><strong>Tu suscripción venció{s.fechaVencimiento ? ` el ${formatoFecha(s.fechaVencimiento)}` : ''}.</strong> Puedes consultar tu información, pero no registrar operaciones nuevas hasta renovar.</p>
      {planPath && <Link to={planPath} className={styles.bannerLink}>Renovar</Link>}
    </div>}
    {s?.estado === 'ACTIVA' && s.diasRestantes != null && s.diasRestantes <= DIAS_AVISO && <div className={`${styles.banner} ${styles.bannerWarn}`} role="status">
      <Clock size={18} aria-hidden="true" />
      <p>Tu plan {data?.plan?.nombre} vence {s.diasRestantes === 0 ? 'hoy' : `en ${s.diasRestantes} ${s.diasRestantes === 1 ? 'día' : 'días'}`}.</p>
      {verPlan}
    </div>}
    {restriccion && restriccion.code !== 'SUSCRIPCION_VENCIDA' && <div className={`${styles.banner} ${styles.bannerInfo}`} role="alert">
      <AlertTriangle size={18} aria-hidden="true" />
      <p>{restriccion.message}</p>
      {verPlan}
      <button type="button" className={styles.bannerClose} onClick={() => setRestriccion(null)} aria-label="Cerrar aviso"><X size={16} /></button>
    </div>}
  </div>
}
