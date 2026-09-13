import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogOut, Shirt, Store, Package, ArrowRight, Search, ImageOff } from 'lucide-react'
import { Brand } from '../components/common/Brand'
import { ProductImage } from '../components/ui/ProductImage'
import { useAuth } from '../hooks/useAuth'
import { api } from '../api/axios'
import { getApiErrorMessage } from '../utils/apiError'

interface Product {
  idProducto: number
  nombre: string
  descripcion?: string
  precio: string | number
  imagenUrl?: string
  estado: boolean
  categoria?: { nombre: string }
}
interface Branch { idSucursal: number; nombre: string; direccion: string; telefono?: string; estado: boolean; ciudad?: { nombre: string } }
interface Stock { idInventario: number; stockDisponible: number; stockReservado: number; sucursal?: { nombre: string }; variante?: { sku: string; producto?: { nombre: string }; talla?: { nombre: string }; color?: { nombre: string } } }
type Tab = 'catalog' | 'branches' | 'inventory'
const urls: Record<Tab, string> = { catalog: '/catalog/productos', branches: '/branches/sucursales', inventory: '/inventory/inventarios' }

export default function Workspace({ mode }: { mode: 'store' | 'admin' | 'pos' }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>(mode === 'pos' ? 'inventory' : 'catalog')
  const [products, setProducts] = useState<Product[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [stock, setStock] = useState<Stock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [retry, setRetry] = useState(0)
  const [closing, setClosing] = useState(false)
  const staff = mode !== 'store'

  useEffect(() => {
    const controller = new AbortController()
    api.get(urls[tab], { signal: controller.signal }).then(({ data }) => {
      if (tab === 'catalog') setProducts(data)
      if (tab === 'branches') setBranches(data)
      if (tab === 'inventory') setStock(data)
    }).catch(err => {
      if (!controller.signal.aborted) setError(getApiErrorMessage(err))
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [tab, retry])

  function changeTab(value: Tab) {
    if (tab === value) return
    setLoading(true)
    setError('')
    setSearch('')
    setTab(value)
  }

  async function handleLogout() {
    setClosing(true)
    try { await logout() } catch { /* La sesión local ya fue eliminada. */ }
    navigate('/', { replace: true })
  }

  const query = search.toLocaleLowerCase()
  const visibleProducts = products.filter(product => (staff || product.estado) && `${product.nombre} ${product.categoria?.nombre ?? ''}`.toLocaleLowerCase().includes(query))
  const visibleBranches = branches.filter(branch => (staff || branch.estado) && `${branch.nombre} ${branch.direccion} ${branch.ciudad?.nombre ?? ''}`.toLocaleLowerCase().includes(query))
  const visibleStock = stock.filter(item => `${item.variante?.sku ?? ''} ${item.variante?.producto?.nombre ?? ''} ${item.sucursal?.nombre ?? ''}`.toLocaleLowerCase().includes(query))
  const empty = tab === 'catalog' ? visibleProducts.length === 0 : tab === 'branches' ? visibleBranches.length === 0 : visibleStock.length === 0

  return <div className="workspace">
    <header className="workspace-header"><Brand /><div className="workspace-user"><span>{user?.nombre || user?.email}<small>{user?.rol}</small></span><button onClick={handleLogout} disabled={closing} className="logout-button"><LogOut size={17} /> Salir</button></div></header>
    <main className="workspace-main">
      <div className="workspace-intro"><div><p className="eyebrow">{staff ? 'Espacio de trabajo' : 'Tu universo de moda'}</p><h1>{mode === 'pos' ? 'Punto de venta' : mode === 'admin' ? 'Tu tienda, en un solo lugar' : 'Encuentra tu próxima prenda favorita'}</h1><p>{mode === 'pos' ? 'Consulta las prendas y el stock de nuestras sucursales. El cobro y la facturación estarán disponibles en una próxima etapa.' : staff ? 'Consulta el catálogo, las sucursales y las existencias de Fashionstore.' : 'Descubre nuestro catálogo y encuentra una sucursal para visitarnos.'}</p></div><Link to="/" className="back-link">Ver inicio <ArrowRight size={17} /></Link></div>
      <nav className="workspace-tabs" aria-label="Secciones de tu espacio"><button className={tab === 'catalog' ? 'active' : ''} onClick={() => changeTab('catalog')} aria-current={tab === 'catalog' ? 'page' : undefined}><Shirt size={18} />Catálogo</button><button className={tab === 'branches' ? 'active' : ''} onClick={() => changeTab('branches')} aria-current={tab === 'branches' ? 'page' : undefined}><Store size={18} />Sucursales</button>{staff && <button className={tab === 'inventory' ? 'active' : ''} onClick={() => changeTab('inventory')} aria-current={tab === 'inventory' ? 'page' : undefined}><Package size={18} />Inventario</button>}</nav>
      <div className="collection-heading"><h2>{tab === 'catalog' ? 'Nuestro catálogo' : tab === 'branches' ? 'Encuéntranos en tienda' : 'Existencias por sucursal'}</h2><label className="search-field"><Search size={18} /><input aria-label="Buscar en la sección" placeholder="Buscar…" value={search} onChange={event => setSearch(event.target.value)} /></label></div>
      {loading ? <div className="empty-state" role="status">Cargando información…</div> : error ? <div className="empty-state" role="alert"><p>{error}</p><button className="primary-button" onClick={() => { setError(''); setLoading(true); setRetry(value => value + 1) }}>Reintentar</button></div> : empty ? <div className="empty-state"><ShoppingEmpty /><h3>{search ? 'No encontramos coincidencias' : 'Pronto habrá novedades aquí'}</h3><p>{search ? 'Prueba con otra búsqueda.' : 'Todavía no hay registros disponibles en esta sección.'}</p></div> : <>
        {tab === 'catalog' && <div className="product-grid">{visibleProducts.map(product => <article className="product-card" key={product.idProducto}><ProductImage src={product.imagenUrl} name={product.nombre} /><div className="product-info"><p className="eyebrow">{product.categoria?.nombre || 'Fashionstore'}</p><h3>{product.nombre}</h3><p>{product.descripcion}</p><strong>{Number(product.precio).toLocaleString('es-BO', { style: 'currency', currency: 'BOB' })}</strong>{!product.estado && <small>Inactivo</small>}</div></article>)}</div>}
        {tab === 'branches' && <div className="product-grid">{visibleBranches.map(branch => <article className="branch-card" key={branch.idSucursal}><Store size={30} /><h3>{branch.nombre}</h3><p>{branch.ciudad?.nombre}</p><p>{branch.direccion}</p>{branch.telefono && <p>{branch.telefono}</p>}</article>)}</div>}
        {tab === 'inventory' && <div className="table-scroll"><table><thead><tr><th>Prenda / SKU</th><th>Sucursal</th><th>Talla</th><th>Color</th><th>Disponible</th><th>Reservado</th></tr></thead><tbody>{visibleStock.map(item => <tr key={item.idInventario}><td>{item.variante?.producto?.nombre}<small>{item.variante?.sku}</small></td><td>{item.sucursal?.nombre || '—'}</td><td>{item.variante?.talla?.nombre || '—'}</td><td>{item.variante?.color?.nombre || '—'}</td><td>{item.stockDisponible}</td><td>{item.stockReservado}</td></tr>)}</tbody></table></div>}
      </>}
    </main>
  </div>
}

function ShoppingEmpty() { return <ImageOff size={34} strokeWidth={1.4} aria-hidden="true" /> }
