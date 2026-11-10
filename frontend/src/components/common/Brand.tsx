import { ShoppingBag } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useStore } from '../../features/store/storeContext'

export function Brand({ className = '' }: { className?: string }) {
  const store = useStore()
  // Tienda de otra empresa (/t/:slug): se muestra su nombre.
  if (store.slug && store.slug !== 'fashionstore') {
    return <Link to={store.base} className={`brand ${className}`} aria-label={`${store.nombre}, ir al inicio de la tienda`}>
      <ShoppingBag size={25} aria-hidden="true" /><span>{store.nombre}</span>
    </Link>
  }
  return <Link to="/t/fashionstore" className={`brand ${className}`} aria-label="Fashionstore, ir al inicio de la tienda">
    <ShoppingBag size={25} aria-hidden="true" /><span>Fashion<span className="brand-accent">store</span></span>
  </Link>
}
