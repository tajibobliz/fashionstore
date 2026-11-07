import dashboardStyles from '../dashboard/Dashboard.module.css'
import { KpisPanel } from './KpisPanel'

/**
 * Dashboard analítico (CU12, Fase 3 tarea 3.4): indicadores clave del negocio.
 * Las pestañas "Análisis predictivo" y "Descubrir patrones" (ML) se agregan en la 3.4b.
 */
export default function AnalyticsPage({ base, secciones }: { base: string; secciones: Set<string> }) {
  return (
    <section className={dashboardStyles.content}>
      <div className={dashboardStyles.pageHeading}>
        <div>
          <p className={dashboardStyles.kicker}>Dashboard analítico</p>
          <h1>Indicadores del negocio</h1>
          <p>Ventas, inventario, reservas, devoluciones y cambios. Haz clic en un indicador para ver el detalle.</p>
        </div>
      </div>
      <KpisPanel base={base} secciones={secciones} />
    </section>
  )
}
