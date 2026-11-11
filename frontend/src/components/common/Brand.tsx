import { ShoppingBag } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useStore } from '../../features/store/storeContext'

/**
 * Logo de la tienda. Muestra la empresa de la página (/t/:slug) o, en los paneles internos
 * (que no están bajo /t/:slug), la empresa que se le pase en `tienda` (la del usuario).
 */
export function Brand({ className = '', tienda }: { className?: string; tienda?: { slug: string; nombre: string } | null }) {
  const store = useStore()
  const empresa = tienda ?? (store.slug ? { slug: store.slug, nombre: store.nombre } : null)
  // Tienda de otra empresa: se muestra su nombre.
  if (empresa && empresa.slug !== 'fashionstore') {
    const destino = store.slug === empresa.slug ? store.base : `/t/${empresa.slug}`
    return <Link to={destino} className={`brand ${className}`} aria-label={`${empresa.nombre}, ir al inicio de la tienda`}>
      <ShoppingBag size={25} aria-hidden="true" /><span>{empresa.nombre}</span>
    </Link>
  }
  return <Link to="/t/fashionstore" className={`brand ${className}`} aria-label="Fashionstore, ir al inicio de la tienda">
    <ShoppingBag size={25} aria-hidden="true" /><span>Fashion<span className="brand-accent">store</span></span>
  </Link>
}
