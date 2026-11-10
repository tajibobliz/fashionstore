import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, ArrowUpRight, Camera, CreditCard, MapPin } from 'lucide-react'
import { Brand } from '../../components/common/Brand'
import { catalogApi } from '../../api/catalog.api'
import { saasApi } from '../../api/saas.api'
import type { Producto } from '../../types/catalog'
import { useAuth } from '../../hooks/useAuth'
import { getSessionPath } from '../../routes/auth'
import { formatMoney } from '../../utils/money'
import styles from './Home.module.css'

/** Solo fotos de prendas reales en la portada (las de picsum son paisajes al azar). */
const esFotoDePrenda = (url?: string | null) => !!url && !/picsum\.photos/.test(url)
/** dummyjson tiene la miniatura (thumbnail) y la foto grande (1.webp): en la portada va la grande. */
const enAlta = (url: string) => url.replace(/\/thumbnail\.webp$/, '/1.webp')

/** Foto de la prenda; si no carga, un bloque marfil con la inicial en serif. */
function Foto({ producto, className }: { producto: Producto; className?: string }) {
  const [falla, setFalla] = useState(false)
  if (!producto.imagenUrl || falla)
    return <div className={`${styles.sinFoto} ${className ?? ''}`} aria-hidden="true"><span>{producto.nombre.charAt(0)}</span></div>
  return <img className={className} src={enAlta(producto.imagenUrl)} alt={producto.nombre} loading="lazy" onError={() => setFalla(true)} />
}

const LEMA = 'Vestidos, zapatos, blusas y accesorios elegidos para acompañarte en cada momento. Descúbrelos online y vívelos en nuestras tiendas.'

const SERVICIOS = [
  { icon: Camera, titulo: 'Probador virtual', texto: 'Pruébate poleras y sombreros con la cámara antes de comprar.' },
  { icon: MapPin, titulo: 'Retiro en tienda', texto: 'Reserva online y recoge en tu sucursal favorita, sin costo.' },
  { icon: CreditCard, titulo: 'Paga a tu manera', texto: 'Tarjeta, QR, transferencia o efectivo al retirar.' },
]

/**
 * Portada de la tienda original FashionStore (/t/fashionstore). Estilo boutique editorial
 * (marfil, tinta y champaña, títulos en serif), distinto a la portada genérica de las demás
 * tiendas (StoreHome). Los enlaces de sesión son los mismos de siempre: /login, /register,
 * /tienda y el panel según el rol (getSessionPath).
 */
export default function Home() {
  const { user, isAuthenticated } = useAuth()
  const destination = user && isAuthenticated ? getSessionPath(user.rol, user.empresa?.slug) : '/login'
  const [categoriaActiva, setCategoriaActiva] = useState(0)
  const [portadaFalla, setPortadaFalla] = useState(false)

  // Imagen y frase que el administrador elige en "Portada de la tienda" (misma clave que StoreScope,
  // así se actualiza en cuanto se guarda). Sin imagen se usa la foto de un vestido del catálogo.
  const tienda = useQuery({ queryKey: ['saas', 'tienda', 'fashionstore'], queryFn: () => saasApi.tienda('fashionstore'), staleTime: 5 * 60_000, retry: false })
  const portadaUrl = !portadaFalla ? tienda.data?.portadaUrl : null
  const eslogan = tienda.data?.eslogan

  const productos = useQuery({ queryKey: ['store-home', 'fashionstore', 'productos'], queryFn: catalogApi.products.list, staleTime: 5 * 60_000 })
  const activos = (productos.data ?? []).filter(p => p.estado !== false)
  const conFoto = activos.filter(p => esFotoDePrenda(p.imagenUrl))
  const porCategoria = (nombre: string) => conFoto.find(p => p.categoria?.nombre === nombre)
  // Portada: un vestido grande, y zapatos y accesorio a los lados (si existen).
  const principal = porCategoria('Vestidos') ?? conFoto[0]
  const laterales = [porCategoria('Zapatos'), porCategoria('Accesorios') ?? porCategoria('Blusas')].filter((p): p is Producto => !!p && p !== principal)
  const lookbook = [...conFoto].sort((a, b) => b.idProducto - a.idProducto).slice(0, 10)
  const probador = activos.find(p => p.tipoTryOn && p.imagenTryOn)

  const categorias = [...activos.reduce((m, p) => {
    const n = p.categoria?.nombre
    if (!n) return m
    const c = m.get(n) ?? { nombre: n, cantidad: 0, muestra: undefined as Producto | undefined }
    c.cantidad++
    if (!c.muestra && esFotoDePrenda(p.imagenUrl)) c.muestra = p
    return m.set(n, c)
  }, new Map<string, { nombre: string; cantidad: number; muestra?: Producto }>()).values()].sort((a, b) => b.cantidad - a.cantidad).slice(0, 6)
  const muestraActiva = categorias[categoriaActiva]?.muestra ?? principal

  return <div className={styles.page}>
    <p className={styles.aviso}>Nueva colección · Retiro gratis en tienda · Probador virtual con tu cámara</p>

    <nav className={styles.navbar} aria-label="Navegación principal">
      <div className={styles.navLinks}><a href="#coleccion">Colección</a><a href="#lookbook">Lookbook</a><a href="#experiencia">Experiencia</a></div>
      <Brand className={styles.logo} />
      <div className={styles.navActions}>
        <Link to="/tienda" className={styles.navLink}>Tienda</Link>
        <Link to={destination} className={styles.navCta}>{isAuthenticated ? 'Mi espacio' : 'Iniciar sesión'}</Link>
      </div>
    </nav>

    <main>
      <section className={styles.hero}>
        <div className={`${styles.heroFoto} ${styles.heroPrincipal}`}>
          {portadaUrl ? <img src={portadaUrl} alt="Portada de Fashionstore" onError={() => setPortadaFalla(true)} />
            : principal ? <Foto producto={principal} /> : <div className={styles.cargando} />}
          <span className={styles.temporada}>Colección {new Date().getFullYear()}</span>
        </div>
        <div className={styles.heroTexto}>
          <p className={styles.kicker}>Moda femenina · Online y en tienda</p>
          <h1>La elegancia <em>se lleva</em> puesta.</h1>
          <p className={styles.lead}>{eslogan || LEMA}</p>
          <div className={styles.acciones}>
            <Link to="/tienda" className={styles.btnOscuro}>Descubrir la colección <ArrowRight size={16} aria-hidden="true" /></Link>
            {!isAuthenticated && <Link to="/register" className={styles.btnLinea}>Crear mi cuenta</Link>}
          </div>
        </div>
        <div className={styles.heroLateral}>
          {laterales.length ? laterales.map(p => <Link key={p.idProducto} to="/tienda" className={styles.heroFoto} tabIndex={-1}><Foto producto={p} /><span className={styles.etiqueta}>{p.categoria?.nombre}</span></Link>)
            : [0, 1].map(i => <div key={i} className={`${styles.heroFoto} ${styles.cargando}`} />)}
        </div>
      </section>

      {categorias.length > 0 && <section id="coleccion" className={styles.coleccion}>
        <div className={styles.indice}>
          <p className={styles.kicker}>La colección</p>
          <h2>Elige por <em>categoría</em></h2>
          <ol className={styles.listaCategorias}>
            {categorias.map((c, i) => <li key={c.nombre}>
              <Link to="/tienda" onMouseEnter={() => setCategoriaActiva(i)} onFocus={() => setCategoriaActiva(i)} className={i === categoriaActiva ? styles.categoriaActiva : undefined}>
                <span className={styles.numero}>{String(i + 1).padStart(2, '0')}</span>
                <span className={styles.nombreCategoria}>{c.nombre}</span>
                <span className={styles.cantidad}>{c.cantidad} {c.cantidad === 1 ? 'prenda' : 'prendas'}</span>
                <ArrowUpRight size={20} aria-hidden="true" />
              </Link>
            </li>)}
          </ol>
        </div>
        <div className={styles.vistaCategoria} aria-hidden="true">
          {muestraActiva && <Foto key={muestraActiva.idProducto} producto={muestraActiva} className={styles.aparecer} />}
        </div>
      </section>}

      <section id="lookbook" className={styles.lookbook}>
        <div className={styles.encabezado}>
          <div><p className={styles.kicker}>Lookbook</p><h2>Seleccionado <em>para ti</em></h2></div>
          <Link to="/tienda" className={styles.verTodo}>Ver toda la tienda <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
        {productos.isLoading ? <div className={styles.carrusel}>{[0, 1, 2, 3].map(i => <div key={i} className={`${styles.tarjeta} ${styles.cargando}`} style={{ aspectRatio: '3 / 4.6' }} />)}</div>
          : lookbook.length === 0 ? <p className={styles.vacio}>Muy pronto verás aquí la nueva colección.</p>
          : <div className={styles.carrusel}>
            {lookbook.map(p => <Link key={p.idProducto} to="/tienda" className={styles.tarjeta}>
              <div className={styles.tarjetaFoto}><Foto producto={p} /></div>
              <span className={styles.tarjetaCategoria}>{p.categoria?.nombre}</span>
              <strong>{p.nombre}</strong>
              <span className={styles.precio}>{formatMoney(p.precio)}</span>
            </Link>)}
          </div>}
      </section>

      <section id="experiencia" className={styles.experiencia}>
        <div className={styles.manifiesto}>
          <p className={styles.kicker}>La experiencia Fashionstore</p>
          <blockquote>“Prendas pensadas para durar, elegidas para que te sientas <em>tú</em>.”</blockquote>
          <ul className={styles.servicios}>
            {SERVICIOS.map(({ icon: Icon, titulo, texto }) => <li key={titulo}><Icon size={22} aria-hidden="true" /><div><strong>{titulo}</strong><p>{texto}</p></div></li>)}
          </ul>
        </div>
        <div className={styles.probador}>
          {probador ? <>
            <div className={styles.probadorFoto}><img src={probador.imagenTryOn!} alt={`Imagen del probador para ${probador.nombre}`} loading="lazy" /></div>
            <p className={styles.kicker}>Probador virtual</p>
            <h3>Pruébatelo <em>sin salir de casa</em></h3>
            <p>Abre la cámara y mira cómo te queda la {probador.nombre.toLowerCase()} antes de comprarla.</p>
            <Link to={`/vestidor/${probador.idProducto}`} className={styles.btnClaro}>Probar ahora <Camera size={16} aria-hidden="true" /></Link>
          </> : <>
            <p className={styles.kicker}>En tienda</p>
            <h3>Te esperamos <em>en persona</em></h3>
            <p>Reserva online y pruébate la prenda en tu sucursal favorita.</p>
            <Link to="/tienda" className={styles.btnClaro}>Reservar una prenda <ArrowRight size={16} aria-hidden="true" /></Link>
          </>}
        </div>
      </section>

      <section className={styles.cierre}>
        <h2>Tu próximo capítulo de estilo <em>empieza aquí</em>.</h2>
        <div className={styles.acciones}>
          <Link to={isAuthenticated ? destination : '/register'} className={styles.btnOscuro}>{isAuthenticated ? 'Volver a mi espacio' : 'Crear mi cuenta'} <ArrowRight size={16} aria-hidden="true" /></Link>
          <Link to="/login" className={styles.btnLinea}>Acceso del equipo</Link>
        </div>
      </section>
    </main>

    <footer className={styles.footer}>
      <div className={styles.footerGrid}>
        <div><Brand className={styles.logoPie} /><p>Moda femenina con esencia propia.<br />Online y en nuestras tiendas.</p></div>
        <div><strong>Descubre</strong><ul><li><a href="#coleccion">Colección</a></li><li><a href="#lookbook">Lookbook</a></li><li><Link to="/tienda">Tienda online</Link></li></ul></div>
        <div><strong>Tu cuenta</strong><ul><li><Link to={destination}>Mi espacio</Link></li><li><Link to="/register">Crear cuenta</Link></li></ul></div>
        <div><strong>Equipo</strong><ul><li><Link to="/login">Acceso del equipo</Link></li><li><a href="#experiencia">Nuestras tiendas</a></li></ul></div>
      </div>
      <p className={styles.footerBottom}>© {new Date().getFullYear()} Fashionstore. Todos los derechos reservados.</p>
    </footer>
  </div>
}
