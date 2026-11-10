import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BrainCircuit, Gauge, Lock, RefreshCw, Sparkles } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { usePlan } from '../plan/usePlan'
import dashboardStyles from '../dashboard/Dashboard.module.css'
import { KpisPanel } from './KpisPanel'
import { PatronesPanel } from './PatronesPanel'
import { PredictivoPanel } from './PredictivoPanel'
import { useMl } from './useMl'
import styles from './Analytics.module.css'

type Pestana = 'indicadores' | 'predictivo' | 'patrones'
const hora = new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeStyle: 'short' })

/**
 * Dashboard analítico (CU12): indicadores (KPIs) + resultados de ML.
 * "Análisis predictivo" (supervisado) y "Descubrir patrones" (no supervisado) solo para
 * ADMIN y ENCARGADO con un plan que incluya ML. Los modelos se reentrenan solos cada noche;
 * el ADMIN puede forzarlo con "Actualizar análisis".
 */
export default function AnalyticsPage({ base, secciones }: { base: string; secciones: Set<string> }) {
  const { user } = useAuth()
  const plan = usePlan()
  const rol = user?.rol
  const rolConMl = rol === 'ADMIN' || rol === 'ENCARGADO'
  const planConMl = plan.data?.plan?.features.ml === true
  const [pestana, setPestana] = useState<Pestana>('indicadores')

  const pestanas: { id: Pestana; label: string; icon: typeof Gauge }[] = [
    { id: 'indicadores', label: 'Indicadores', icon: Gauge },
    ...(rolConMl ? [
      { id: 'predictivo' as const, label: 'Análisis predictivo', icon: Sparkles },
      { id: 'patrones' as const, label: 'Descubrir patrones', icon: BrainCircuit },
    ] : []),
  ]

  return (
    <section className={dashboardStyles.content}>
      <div className={dashboardStyles.pageHeading}>
        <div>
          <p className={dashboardStyles.kicker}>Dashboard analítico</p>
          <h1>{pestana === 'indicadores' ? 'Indicadores del negocio' : pestana === 'predictivo' ? 'Análisis predictivo' : 'Descubrir patrones'}</h1>
          <p>{pestana === 'indicadores'
            ? 'Ventas, inventario, reservas, devoluciones y cambios. Haz clic en un indicador para ver el detalle.'
            : pestana === 'predictivo'
              ? 'Cuántas unidades se esperan vender en las próximas semanas, por producto y sucursal.'
              : 'Grupos de clientes con comportamiento parecido y semanas con ventas fuera de lo normal.'}</p>
        </div>
      </div>

      {pestanas.length > 1 && (
        <div className={styles.tabs} role="tablist" aria-label="Secciones del dashboard analítico">
          {pestanas.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" role="tab" aria-selected={pestana === id} className={pestana === id ? styles.tabActive : undefined} onClick={() => setPestana(id)}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>
      )}

      {pestana === 'indicadores' && <KpisPanel base={base} secciones={secciones} />}
      {pestana !== 'indicadores' && (planConMl
        ? <SeccionMl pestana={pestana} esAdmin={rol === 'ADMIN'} />
        : plan.data && (
          <div className={`${dashboardStyles.panel} ${styles.locked}`}>
            <Lock size={22} />
            <div>
              <h2>Tu plan {plan.data.plan?.nombre} no incluye la analítica con Machine Learning</h2>
              <p>Está disponible en los planes Profesional y Empresarial.</p>
              {rol === 'ADMIN' && secciones.has('mi-plan') && <Link to={`${base}/mi-plan`} className={dashboardStyles.textLink}>Ver planes y mejorar</Link>}
            </div>
          </div>
        ))}
    </section>
  )
}

function SeccionMl({ pestana, esAdmin }: { pestana: 'predictivo' | 'patrones'; esAdmin: boolean }) {
  const ml = useMl()
  const m = ml.metricas
  return (
    <div className={styles.stack}>
      <div className={`${dashboardStyles.panel} ${styles.mlStatus}`}>
        <p>
          {ml.preparando
            ? m ? 'Actualizando el análisis con los datos más recientes…' : 'Preparando tu análisis por primera vez (tarda unos segundos)…'
            : m ? <>Análisis actualizado el <strong>{hora.format(new Date(m.meta.entrenadoEn))}</strong> · se actualiza automáticamente cada noche</> : null}
        </p>
        {esAdmin && m && (
          <button type="button" onClick={() => void ml.actualizar()} disabled={ml.preparando}>
            <RefreshCw size={15} className={ml.preparando ? styles.spin : undefined} /> {ml.preparando ? 'Actualizando…' : 'Actualizar análisis'}
          </button>
        )}
      </div>
      {ml.error && <p className={dashboardStyles.errorNotice}>{ml.error}</p>}
      {!m && ml.preparando && <div className={dashboardStyles.chartLoading} role="status">Generando datos de entrenamiento y entrenando los modelos…</div>}
      {m && pestana === 'predictivo' && <PredictivoPanel metricas={m} />}
      {m && pestana === 'patrones' && <PatronesPanel metricas={m} verClientes={esAdmin} />}
    </div>
  )
}
