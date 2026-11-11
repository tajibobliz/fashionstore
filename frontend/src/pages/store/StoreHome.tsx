import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CreditCard, MapPin, ShoppingBag, Sparkles, Store, Truck, WifiOff } from 'lucide-react'
import { catalogApi } from '../../api/catalog.api'
import type { Producto } from '../../types/catalog'
import { useStore } from '../../features/store/storeContext'
import { useAuth } from '../../hooks/useAuth'
import { getSessionPath } from '../../routes/auth'
import { formatMoney } from '../../utils/money'
import styles from './StoreHome.module.css'

/** Tonos para las tarjetas sin foto (se eligen por id, así cada prenda tiene siempre el mismo). */
const TONOS = ['#ad3e68', '#3e5aad', '#2f8a6b', '#c0762f', '#6b3ead', '#2f7f8a']
const tono = (n: number) => TONOS[Math.abs(n) % TONOS.length]

const BENEFICIOS = [
  { icon: MapPin, titulo: 'Retira en tienda', texto: 'Reserva online y recoge en la sucursal que prefieras.' },
  { icon: CreditCard, titulo: 'Paga como quieras', texto: 'Tarjeta, QR, transferencia o al recoger.' },
  { icon: Truck, titulo: 'Stock real', texto: 'Ves la disponibilidad de cada talla y color por sucursal.' },
  { icon: WifiOff, titulo: 'Sin conexión', texto: 'Arma tu pedido sin internet; se envía al volver la señal.' },
]

/** Foto de la prenda; si no hay o no carga, un bloque de color con la inicial. */
function Foto({ producto, className }: { producto: Producto; className?: string }) {
  const [falla, setFalla] = useState(false)
  if (!producto.imagenUrl || falla)
    return <div className={`${styles.placeholder} ${className ?? ''}`} style={{ background: tono(producto.idProducto) }} aria-hidden="true">
      <span>{producto.nombre.charAt(0)}</span>
    </div>
  return <img className={className} src={producto.imagenUrl} alt={producto.nombre} loading="lazy" onError={() => setFalla(true)} />
}

/**
 * Portada de la tienda online de cada empresa (/t/:slug), al estilo de las tiendas de moda:
 * portada con fotos, categorías, novedades y beneficios. Solo usa datos públicos del catálogo;
 * sin sesión, las consultas salen con X-Tenant, así que cada tienda ve únicamente lo suyo.
 */
export default function StoreHome() {
  const { nombre, base, slug, portadaUrl, eslogan } = useStore()
  const [portadaFalla, setPortadaFalla] = useState(false)
  const conPortada = !!portadaUrl && !portadaFalla
  const { user, isAuthenticated } = useAuth()
  const cuenta = isAuthenticated && user ? (user.rol === 'CLIENTE' ? `${base}/tienda` : getSessionPath(user.rol, user.empresa?.slug)) : `${base}/login`
  const catalogo = `${base}/tienda`

  // La clave incluye el slug para no mezclar el catálogo de dos tiendas en la caché.
  const productos = useQuery({ queryKey: ['store-home', slug, 'productos'], queryFn: catalogApi.products.list, staleTime: 5 * 60_000 })
  const activos = (productos.data ?? []).filter(p => p.estado !== false).sort((a, b) => b.idProducto - a.idProducto)
  const conFoto = activos.filter(p => p.imagenUrl)
  // Con imagen de portada (la elige el administrador) va en el recuadro grande; si no, 3 prendas.
  const portada = (conFoto.length >= 3 ? conFoto : activos).slice(0, conPortada ? 2 : 3)
  // Filas completas de 4 (con 6 prendas se ven 4, no una fila con una sola tarjeta).
  const novedades = activos.slice(0, activos.length < 4 ? activos.length : Math.min(8, Math.floor(activos.length / 4) * 4))

  // Categorías con prendas, cada una con la foto de su prenda más reciente.
  const categorias = [...activos.reduce((m, p) => {
    if (!p.categoria) return m
    const c = m.get(p.categoria.nombre)
    if (c) c.cantidad++
    else m.set(p.categoria.nombre, { nombre: p.categoria.nombre, cantidad: 1, muestra: p })
    return m
  }, new Map<string, { nombre: string; cantidad: number; muestra: Producto }>()).values()].sort((a, b) => b.cantidad - a.cantidad).slice(0, 6)

  return <div className={styles.page}>
    <div className={styles.announce}><Sparkles size={14} aria-hidden="true" /> Reserva online y retira gratis en tienda · Paga con tarjeta, QR o transferencia</div>

    <header className={styles.top}>
      <Link to={base} className={styles.brand}><ShoppingBag size={22} aria-hidden="true" />{nombre}</Link>
      <nav className={styles.nav} aria-label="Secciones">
        <a href="#novedades">Novedades</a>
        {categorias.length > 0 && <a href="#categorias">Categorías</a>}
        <Link to={catalogo}>Catálogo</Link>
        <Link to={cuenta} className={styles.cta}>{isAuthenticated ? 'Mi cuenta' : 'Iniciar sesión'}</Link>
      </nav>
    </header>

    <main>
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <p className={styles.eyebrow}><Store size={14} aria-hidden="true" /> Tienda online y en sucursales</p>
          <h1>Tu estilo, <em>a tu manera</em>, en {nombre}</h1>
          <p className={styles.lead}>{eslogan || 'Descubre lo nuevo de la temporada, elige tu talla y color, y compra online o reserva para retirar en tu sucursal favorita.'}</p>
          <div className={styles.actions}>
            <Link to={catalogo} className={styles.primary}>Comprar ahora <ArrowRight size={16} aria-hidden="true" /></Link>
            {!isAuthenticated && <Link to={`${base}/register`} className={styles.secondary}>Crear mi cuenta</Link>}
          </div>
          {activos.length > 0 && <dl className={styles.stats}>
            <div><dt>Prendas</dt><dd>{activos.length}</dd></div>
            {categorias.length > 0 && <div><dt>Categorías</dt><dd>{categorias.length}</dd></div>}
            <div><dt>Retiro</dt><dd>Gratis</dd></div>
          </dl>}
        </div>
        <div className={styles.collage} aria-hidden={portada.length === 0 && !conPortada}>
          {conPortada && <Link to={catalogo} className={`${styles.tile} ${styles.tile0}`} tabIndex={-1}>
            <img src={portadaUrl!} alt={`Portada de ${nombre}`} onError={() => setPortadaFalla(true)} />
            <span className={styles.badge}>Nueva temporada</span>
          </Link>}
          {portada.length > 0
            ? portada.map((p, i) => { const pos = conPortada ? i + 1 : i
              return <Link key={p.idProducto} to={catalogo} className={`${styles.tile} ${styles[`tile${pos}`]}`} tabIndex={-1}>
                <Foto producto={p} />
                {pos === 0 && <span className={styles.badge}>Nuevo</span>}
              </Link> })
            : [0, 1, 2].map(i => <div key={i} className={`${styles.tile} ${styles[`tile${i}`]} ${styles.skeleton}`} />)}
        </div>
      </section>

      {categorias.length > 0 && <div className={styles.marquee} aria-hidden="true">
        <div className={styles.track}>
          {[...categorias, ...categorias, ...categorias, ...categorias].map((c, i) => <span key={i}>{c.nombre} <i>✦</i></span>)}
        </div>
      </div>}

      {categorias.length > 0 && <section id="categorias" className={styles.section}>
        <div className={styles.heading}>
          <div><p className={styles.kicker}>Explora</p><h2>Compra por categoría</h2></div>
          <Link to={catalogo} className={styles.more}>Ver todo <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
        <div className={styles.categories}>
          {categorias.map(c => <Link key={c.nombre} to={catalogo} className={styles.category}>
            <Foto producto={c.muestra} />
            <div className={styles.categoryInfo}><strong>{c.nombre}</strong><span>{c.cantidad} {c.cantidad === 1 ? 'prenda' : 'prendas'}</span></div>
          </Link>)}
        </div>
      </section>}

      <section id="novedades" className={styles.section}>
        <div className={styles.heading}>
          <div><p className={styles.kicker}>Recién llegado</p><h2>Novedades</h2></div>
          <Link to={catalogo} className={styles.more}>Ver catálogo <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
        {productos.isLoading ? <div className={styles.products}>{Array.from({ length: 4 }, (_, i) => <div key={i} className={`${styles.card} ${styles.skeleton}`} style={{ aspectRatio: '3 / 4.4' }} />)}</div>
          : novedades.length === 0 ? <p className={styles.empty}>Muy pronto verás aquí nuestras prendas. Mientras tanto, visita el catálogo.</p>
          : <div className={styles.products}>
            {novedades.map((p, i) => <Link key={p.idProducto} to={catalogo} className={styles.card}>
              <div className={styles.cardMedia}>
                <Foto producto={p} />
                {i < 3 && <span className={styles.badge}>Nuevo</span>}
                <span className={styles.quick}>Ver tallas y colores</span>
              </div>
              <div className={styles.cardBody}>
                {p.categoria && <span className={styles.cardCat}>{p.categoria.nombre}</span>}
                <strong>{p.nombre}</strong>
                <span className={styles.price}>{formatMoney(p.precio)}</span>
              </div>
            </Link>)}
          </div>}
      </section>

      <section className={styles.benefits} aria-label="Por qué comprar aquí">
        {BENEFICIOS.map(({ icon: Icon, titulo, texto }) => <div key={titulo} className={styles.benefit}>
          <span className={styles.benefitIcon}><Icon size={20} aria-hidden="true" /></span>
          <div><strong>{titulo}</strong><p>{texto}</p></div>
        </div>)}
      </section>

      <section className={styles.banner}>
        <div>
          <p className={styles.kicker}>{isAuthenticated ? 'Hola de nuevo' : 'Únete'}</p>
          <h2>{isAuthenticated ? 'Tu próxima prenda favorita te espera' : `Crea tu cuenta en ${nombre}`}</h2>
          <p>{isAuthenticated ? 'Revisa el catálogo, arma tu carrito y reserva en segundos.' : 'Guarda tu carrito, reserva prendas y sigue tus pedidos desde cualquier dispositivo.'}</p>
        </div>
        <Link to={isAuthenticated ? catalogo : `${base}/register`} className={styles.bannerCta}>{isAuthenticated ? 'Ir al catálogo' : 'Crear mi cuenta gratis'} <ArrowRight size={16} aria-hidden="true" /></Link>
      </section>
    </main>

    <footer className={styles.footer}>
      <div className={styles.footerBrand}>
        <Link to={base} className={styles.brand}><ShoppingBag size={20} aria-hidden="true" />{nombre}</Link>
        <p>Moda para todos los días, online y en nuestras sucursales.</p>
      </div>
      <nav className={styles.footerLinks} aria-label="Enlaces">
        <strong>Tienda</strong>
        <Link to={catalogo}>Catálogo</Link>
        <a href="#novedades">Novedades</a>
        <Link to={cuenta}>{isAuthenticated ? 'Mi cuenta' : 'Iniciar sesión'}</Link>
      </nav>
      <div className={styles.footerBottom}>
        <p>© {new Date().getFullYear()} {nombre}</p>
        <p>Tienda creada con <Link to="/">FashionCloud</Link></p>
      </div>
    </footer>
  </div>
}
