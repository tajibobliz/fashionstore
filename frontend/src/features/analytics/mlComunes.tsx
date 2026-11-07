import type { ReactNode } from 'react'
import { Info, TriangleAlert } from 'lucide-react'
import dashboardStyles from '../dashboard/Dashboard.module.css'
import styles from './Analytics.module.css'

/** Aviso del CU12 (pocos datos, precisión baja, sin patrones claros). */
export function Aviso({ children }: { children: ReactNode }) {
  return <p className={styles.notice} role="note"><TriangleAlert size={16} />{children}</p>
}

/** Tarjeta sencilla de un resultado. */
export function Dato({ titulo, valor, detalle, texto }: { titulo: string; valor: string; detalle?: string; texto?: boolean }) {
  return (
    <article className={`${styles.kpi} ${styles.kpiPlain}`}>
      <span className={styles.kpiTitle}>{titulo}</span>
      <strong className={`${styles.kpiValue} ${texto ? styles.kpiValueText : ''}`}>{valor}</strong>
      {detalle && <span className={styles.kpiDetail}>{detalle}</span>}
    </article>
  )
}

/** Detalle técnico plegable: lo ve quien lo busca (docente, analista), no estorba al dueño de la tienda. */
export function Calidad({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <details className={`${dashboardStyles.panel} ${styles.quality}`}>
      <summary><Info size={16} /> {titulo}</summary>
      <div className={styles.qualityBody}>{children}</div>
    </details>
  )
}
