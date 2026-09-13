import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Brand } from '../../../components/common/Brand'
import styles from './Auth.module.css'

export function AuthLayout({ children }: { children: ReactNode }) {
  return <main className={styles.page}>
    <aside className={styles.panel}><div className={styles.panelContent}>
      <Brand className={styles.logo} />
      <h2>Tu estilo tiene un lugar.<br />Bienvenida a Fashionstore.</h2>
      <p>Descubre moda femenina que va contigo. Una experiencia conectada entre nuestra tienda online y nuestras sucursales.</p>
      <div className={styles.stats}><div><strong>Moda</strong><span>Con tu esencia</span></div><div><strong>Online</strong><span>A tu alcance</span></div><div><strong>En tienda</strong><span>Siempre cerca</span></div></div>
    </div></aside>
    <section className={styles.formSide}><div className={styles.formBox}>
      <Link to="/" className="back-link"><ArrowLeft size={16} /> Volver al inicio</Link>
      <div className="mobile-brand"><Brand /></div>
      {children}
    </div></section>
  </main>
}
