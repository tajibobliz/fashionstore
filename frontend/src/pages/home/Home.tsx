import { ArrowRight, CheckCircle, Shirt, Package, Store, Palette, Sparkles, ShoppingBag } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Brand } from '../../components/common/Brand'
import { useAuth } from '../../hooks/useAuth'
import { getSessionPath } from '../../routes/auth'
import styles from './Home.module.css'

const services = [
  { icon: Shirt, title: 'Moda para cada versión de ti', desc: 'Descubre prendas, colores y tallas para construir tu propio estilo.' },
  { icon: Palette, title: 'Colecciones que inspiran', desc: 'Encuentra tu inspiración entre nuestras categorías, temporadas y colecciones.' },
  { icon: Store, title: 'Tu tienda, más cerca', desc: 'Conoce nuestras sucursales y continúa tu experiencia de moda en persona.' },
  { icon: Package, title: 'Inventario conectado', desc: 'Nuestro equipo consulta las existencias por talla, color y sucursal desde un solo lugar.' },
]
const steps = [
  { label: 'Crea tu cuenta', desc: 'Regístrate con tu nombre y correo electrónico.' },
  { label: 'Descubre el catálogo', desc: 'Explora las prendas y encuentra lo que va contigo.' },
  { label: 'Encuentra tu estilo', desc: 'Conoce los detalles, las tallas y los colores de cada producto.' },
  { label: 'Visítanos en tienda', desc: 'Encuentra una sucursal y recibe atención de nuestro equipo.' },
]

export default function Home() {
  const { user, isAuthenticated } = useAuth()
  const destination = user && isAuthenticated ? getSessionPath(user.rol) : '/login'
  return <div className={styles.page}>
    <nav className={styles.navbar} aria-label="Navegación principal">
      <Brand className={styles.logo} />
      <div className={styles.navLinks}><a href="#services">La experiencia</a><a href="#steps">Cómo funciona</a><a href="#stores">En tienda</a></div>
      <Link to={destination} className={styles.navCta}>{isAuthenticated ? 'Mi espacio' : 'Iniciar sesión'}</Link>
    </nav>
    <main>
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <p className={styles.heroTag}><Sparkles size={14} aria-hidden="true" /> Moda femenina · Online y en tienda</p>
          <h1>Tu estilo. Tu esencia.<br /><span className={styles.highlight}>Tu Fashionstore.</span></h1>
          <p className={styles.heroSubtitle}>Prendas que te acompañan en cada momento. Descubre nuestras colecciones y conecta con una experiencia de moda pensada para ti.</p>
          <div className={styles.heroActions}><Link to={destination} className={styles.btnOrange}>Explorar la tienda <ArrowRight size={16} /></Link><a href="#services" className={styles.btnGhost}>Conoce Fashionstore</a></div>
          <div className={styles.heroStars}><ShoppingBag size={17} /><span>Una misma experiencia, online y en nuestras sucursales</span></div>
        </div>
        <div className={styles.heroImg}><img src="/images/hero.png" width="640" height="640" alt="Ilustración de una mujer descubriendo su tienda online desde el móvil" fetchPriority="high" /></div>
      </section>
      <section id="services" className={styles.services}>
        <div className={styles.sectionHeader}><p className={styles.sectionTag}>Hecho para ti</p><h2>Mucho más que <span className={styles.highlight}>encontrar una prenda</span></h2><p>Estilo, variedad y atención cercana en una sola experiencia.</p></div>
        <div className={styles.servicesGrid}>{services.map(({ icon: Icon, title, desc }) => <article key={title} className={styles.serviceCard}><div className={styles.serviceIcon}><Icon size={32} /></div><h3>{title}</h3><p>{desc}</p></article>)}</div>
      </section>
      <section id="steps" className={styles.stepsSection}>
        <div className={styles.stepsImg}><img src="/images/seller.png" alt="Ilustración de atención y gestión de una tienda" width="640" height="640" loading="lazy" /></div>
        <div className={styles.stepsContent}><p className={styles.sectionTag}>Así de simple</p><h2>Descubre tu próximo <span className={styles.highlight}>look en 4 pasos</span></h2>
          <div className={styles.stepsList}>{steps.map((step, index) => <div key={step.label} className={styles.stepItem}><span className={styles.stepNum}>{index + 1}</span><div><strong>{step.label}</strong><p>{step.desc}</p></div></div>)}</div>
          <Link to={isAuthenticated ? destination : '/register'} className={styles.btnOrange}>{isAuthenticated ? 'Ir a mi espacio' : 'Crear mi cuenta'} <ArrowRight size={16} /></Link>
        </div>
      </section>
      <section id="stores" className={styles.analyticsSection}>
        <div className={styles.analyticsContent}><p className={styles.sectionTag}>El equipo Fashionstore</p><h2>La moda también se vive <span className={styles.highlight}>en persona</span></h2>
          <p className={styles.heroSubtitle}>Un espacio para nuestras clientas y otro para el equipo que hace posible cada experiencia en tienda.</p>
          <ul className={styles.analyticsFeatures}>{['Catálogo con tallas y colores', 'Sucursales y atención cercana', 'Consulta de stock por sucursal', 'Acceso del equipo al punto de venta'].map(text => <li key={text}><CheckCircle size={18} className={styles.check} />{text}</li>)}</ul>
          <Link to="/login" className={styles.btnOrange}>Acceso al equipo <ArrowRight size={16} /></Link>
        </div>
        <div className={styles.analyticsImg}><img src="/images/analytics.png" alt="Ilustración del espacio de gestión de la tienda" loading="lazy" width="640" height="640" /></div>
      </section>
      <section className={styles.ctaBanner}><h2>Encuentra lo que te hace sentir tú.</h2><p>Tu próximo capítulo de estilo empieza en Fashionstore.</p><Link to={isAuthenticated ? destination : '/register'} className={styles.btnWhite}>{isAuthenticated ? 'Volver a mi espacio' : 'Quiero ser parte'}</Link></section>
    </main>
    <footer className={styles.footer}><div className={styles.footerGrid}>
      <div><Brand className={styles.logo} /><p className={styles.footerDesc}>Moda femenina con esencia propia.<br />Online y en nuestras tiendas.</p></div>
      <div><strong>Descubre</strong><ul><li><a href="#services">La experiencia</a></li><li><a href="#steps">Cómo funciona</a></li></ul></div>
      <div><strong>Tu cuenta</strong><ul><li><Link to={destination}>Mi espacio</Link></li><li><Link to="/register">Crear cuenta</Link></li></ul></div>
      <div><strong>En tienda</strong><ul><li><a href="#stores">Nuestras sucursales</a></li><li><Link to="/login">Acceso del equipo</Link></li></ul></div>
    </div><div className={styles.footerBottom}><p>© {new Date().getFullYear()} Fashionstore. Todos los derechos reservados.</p></div></footer>
  </div>
}
