import { Link } from 'react-router-dom'
import { ArrowRight, ShoppingBag, Store } from 'lucide-react'
import { useStore } from '../../features/store/storeContext'
import { useAuth } from '../../hooks/useAuth'
import { getSessionPath } from '../../routes/auth'
import styles from './StoreHome.module.css'

/** Portada genérica de la tienda online de una empresa (/t/:slug). */
export default function StoreHome() {
  const { nombre, base } = useStore()
  const { user, isAuthenticated } = useAuth()
  const cuenta = isAuthenticated && user ? (user.rol === 'CLIENTE' ? `${base}/tienda` : getSessionPath(user.rol)) : `${base}/login`
  return <div className={styles.page}>
    <header className={styles.top}>
      <Link to={base} className={styles.brand}><ShoppingBag size={22} aria-hidden="true" />{nombre}</Link>
      <nav className={styles.nav}>
        <Link to={`${base}/tienda`}>Catálogo</Link>
        <Link to={cuenta} className={styles.cta}>{isAuthenticated ? 'Mi cuenta' : 'Iniciar sesión'}</Link>
      </nav>
    </header>
    <main>
      <section className={styles.hero}>
        <p className={styles.eyebrow}><Store size={14} aria-hidden="true" /> Tienda online y en sucursales</p>
        <h1>Bienvenida a {nombre}</h1>
        <p>Explora el catálogo, elige tu talla y color, y compra online o reserva para retirar en tu sucursal favorita.</p>
        <div className={styles.actions}>
          <Link to={`${base}/tienda`} className={styles.primary}>Ver catálogo <ArrowRight size={16} aria-hidden="true" /></Link>
          {!isAuthenticated && <Link to={`${base}/register`} className={styles.secondary}>Crear mi cuenta</Link>}
        </div>
      </section>
    </main>
    <footer className={styles.footer}>
      <p>© {new Date().getFullYear()} {nombre}</p>
      <p>Tienda creada con <Link to="/">FashionStore SaaS</Link></p>
    </footer>
  </div>
}
