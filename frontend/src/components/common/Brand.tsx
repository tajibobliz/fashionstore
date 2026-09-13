import { ShoppingBag } from 'lucide-react'
import { Link } from 'react-router-dom'

export function Brand({ className = '' }: { className?: string }) {
  return <Link to="/" className={`brand ${className}`} aria-label="Fashionstore, ir al inicio">
    <ShoppingBag size={25} aria-hidden="true" /><span>Fashion<span className="brand-accent">store</span></span>
  </Link>
}
