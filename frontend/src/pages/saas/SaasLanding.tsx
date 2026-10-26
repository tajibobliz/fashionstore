import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ArrowRight, BarChart3, Boxes, Brain, Check, CreditCard, Layers, LayoutGrid, Mic, Minus, Shirt, ShieldCheck, Store, WifiOff,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { saasApi } from '../../api/saas.api'
import type { PlanPublico } from '../../api/saas.api'
import { useAuth } from '../../hooks/useAuth'
import { getSessionPath } from '../../routes/auth'
import styles from './SaasLanding.module.css'

const features: Array<{ icon: LucideIcon; title: string; desc: string }> = [
  { icon: Shirt, title: 'Catálogo de moda', desc: 'Productos con tallas, colores, temporadas y colecciones. Un solo catálogo para todas tus tiendas.' },
  { icon: Store, title: 'Varias sucursales', desc: 'Cada tienda física con su stock, sus almacenes y sus cajas. Tu equipo trabaja solo en las sucursales asignadas.' },
  { icon: CreditCard, title: 'Punto de venta', desc: 'Ventas presenciales con turnos de caja, pagos y devoluciones registrados en el momento.' },
  { icon: Layers, title: 'Tienda online y reservas', desc: 'Tus clientas compran o reservan desde la web y la app, y retiran en la sucursal que prefieran.' },
  { icon: WifiOff, title: 'Sigue vendiendo sin internet', desc: 'Registra ventas y reservas sin conexión; se sincronizan solas cuando vuelve la señal.' },
  { icon: BarChart3, title: 'Reportes y KPIs', desc: 'Ventas por sucursal, productos más vendidos, stock crítico y exportación a Excel o PDF.' },
]

const steps = [
  { title: 'Elige tu plan', desc: 'Según cuántas tiendas y empleados tienes hoy.' },
  { title: 'Registra tu empresa', desc: 'Nombre, dirección web de tu tienda y tu usuario administrador.' },
  { title: 'Configura tus tiendas', desc: 'Crea sucursales, carga tu catálogo y suma a tu equipo.' },
  { title: 'Vende en todos lados', desc: 'En caja, en la web y en la app, con un solo inventario.' },
]

const benefits = [
  { icon: ShieldCheck, title: 'Tus datos, solo tuyos', desc: 'Cada empresa trabaja en su propio espacio. La base de datos impide ver información de otras empresas.' },
  { icon: Boxes, title: 'Crece sin cambiar de sistema', desc: 'Cambia de plan cuando abras más tiendas. No pierdes nada al hacerlo.' },
  { icon: Mic, title: 'Pregunta por voz', desc: '"¿Qué vendí esta semana por sucursal?" y el reporte se arma con tus datos reales.' },
  { icon: Brain, title: 'Analítica inteligente', desc: 'Predicción de demanda y segmentación de clientes para decidir qué reponer.' },
]

const faqs = [
  { q: '¿Qué es una sucursal?', a: 'Cada tienda física de tu negocio. Todas comparten tu catálogo y tus clientes, pero cada una tiene su propio stock, sus almacenes y sus cajas.' },
  { q: '¿Puedo cambiar de plan después?', a: 'Sí, cuando quieras desde "Mi plan". Si bajas de plan y ya superas algún límite, no se borra nada: solo no podrás agregar más hasta ajustarte.' },
  { q: '¿Qué pasa si vence mi suscripción?', a: 'Tus datos siguen ahí y puedes consultarlos, pero no registrar operaciones nuevas hasta renovar.' },
  { q: '¿Otras empresas pueden ver mis datos?', a: 'No. Cada empresa tiene su espacio aislado: el sistema y la base de datos impiden accesos cruzados.' },
  { q: '¿Cómo se paga?', a: 'En esta versión la contratación es simulada: eliges el plan y se activa al instante, sin cobro real.' },
]

const limite = (n: number | null, singular: string, plural: string, ilimitado: string) =>
  n == null ? ilimitado : `Hasta ${n} ${n === 1 ? singular : plural}`

function planItems(p: PlanPublico) {
  return [
    { ok: true, text: limite(p.maxSucursales, 'sucursal activa', 'sucursales activas', 'Sucursales ilimitadas') },
    { ok: true, text: limite(p.maxUsuarios, 'empleado', 'empleados', 'Empleados ilimitados') },
    { ok: true, text: 'Clientes ilimitados' },
    { ok: true, text: 'Productos, ventas, reservas y POS' },
    { ok: true, text: 'Operación sin conexión' },
    { ok: true, text: 'Reportes convencionales y KPIs' },
    { ok: !!p.features.aiReports, text: 'Reportes con IA y por voz' },
    { ok: !!p.features.ml, text: 'Analítica con Machine Learning' },
  ]
}

function HeroDiagram() {
  const nodes = [
    { label: 'Sucursales', x: 16, y: 70 },
    { label: 'Catálogo', x: 196, y: 16 },
    { label: 'Punto de venta', x: 376, y: 70 },
    { label: 'Tienda online', x: 376, y: 334 },
    { label: 'Inventario', x: 196, y: 388 },
    { label: 'Reportes IA', x: 16, y: 334 },
  ]
  const w = 128
  const cx = 260
  const cy = 220
  return <svg className={styles.diagram} viewBox="0 0 520 440" role="img" aria-labelledby="diagram-title">
    <title id="diagram-title">Sucursales, catálogo, punto de venta, tienda online, inventario y reportes conectados a FashionStore</title>
    <defs>
      <linearGradient id="core" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#2f6bf0" /><stop offset="1" stopColor="#0539b0" />
      </linearGradient>
    </defs>
    <circle cx={cx} cy={cy} r="150" className={styles.orbit} />
    <circle cx={cx} cy={cy} r="100" className={styles.orbit} />
    {nodes.map(n => <line key={`l-${n.label}`} x1={n.x + w / 2} y1={n.y + 18} x2={cx} y2={cy} className={styles.link} />)}
    <rect x={cx - 62} y={cy - 62} width="124" height="124" rx="26" fill="url(#core)" />
    <text x={cx} y={cy - 4} textAnchor="middle" className={styles.coreText}>Fashion</text>
    <text x={cx} y={cy + 20} textAnchor="middle" className={styles.coreText}>Store</text>
    {nodes.map(n => <g key={n.label}>
      <rect x={n.x} y={n.y} width={w} height="36" rx="9" className={styles.tile} />
      <text x={n.x + w / 2} y={n.y + 23} textAnchor="middle" className={styles.tileText}>{n.label}</text>
    </g>)}
  </svg>
}

export default function SaasLanding() {
  const { user, isAuthenticated } = useAuth()
  const panel = user && isAuthenticated ? getSessionPath(user.rol) : '/login'
  const planes = useQuery({ queryKey: ['saas', 'planes'], queryFn: saasApi.planes, staleTime: 5 * 60_000 })

  return <div className={styles.page}>
    <header className={styles.nav}>
      <div className={styles.container}>
        <Link to="/" className={styles.brand} aria-label="FashionStore SaaS, inicio"><LayoutGrid size={22} aria-hidden="true" />FashionStore<span>SaaS</span></Link>
        <nav aria-label="Secciones" className={styles.navLinks}>
          <a href="#funcionalidades">Funcionalidades</a><a href="#como-funciona">Cómo funciona</a><a href="#planes">Planes</a><a href="#preguntas">Preguntas</a>
        </nav>
        <div className={styles.navActions}>
          <Link to={panel} className={styles.btnSecondary}>{isAuthenticated ? 'Mi panel' : 'Iniciar sesión'}</Link>
          <a href="#planes" className={styles.btnPrimary}>Contratar</a>
        </div>
      </div>
    </header>

    <main>
      <section className={styles.hero}>
        <div className={`${styles.container} ${styles.heroGrid}`}>
          <div>
            <p className={styles.eyebrow}>Plataforma para negocios de moda</p>
            <h1>Todas tus tiendas de moda, en un solo sistema.</h1>
            <p className={styles.lead}>Catálogo, inventario por sucursal, punto de venta, tienda online y reportes con IA. Contrata un plan, registra tu empresa y empieza a vender el mismo día.</p>
            <div className={styles.actions}>
              <a href="#planes" className={styles.btnPrimary}>Ver planes <ArrowRight size={17} aria-hidden="true" /></a>
              <Link to="/t/fashionstore" className={styles.btnSecondary}>Ver una tienda de ejemplo</Link>
            </div>
          </div>
          <HeroDiagram />
        </div>
        <div className={styles.container}>
          <dl className={styles.facts}>
            <div><dt>3 planes</dt><dd>Básico, Profesional y Empresarial</dd></div>
            <div><dt>Multi-sucursal</dt><dd>Stock y cajas por cada tienda</dd></div>
            <div><dt>Sin conexión</dt><dd>Web y app siguen vendiendo</dd></div>
            <div><dt>Datos aislados</dt><dd>Cada empresa en su espacio</dd></div>
          </dl>
        </div>
      </section>

      <section id="funcionalidades" className={styles.muted}>
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <h2>Lo que necesita una tienda de ropa, sin juntar varios programas</h2>
            <p>Desde la caja de la sucursal hasta la tienda online, todo comparte el mismo catálogo y el mismo inventario.</p>
          </div>
          <div className={styles.featureGrid}>
            {features.map(({ icon: Icon, title, desc }) => <article key={title} className={styles.card}>
              <span className={styles.iconBox}><Icon size={20} aria-hidden="true" /></span>
              <h3>{title}</h3><p>{desc}</p>
            </article>)}
          </div>
        </div>
      </section>

      <section id="como-funciona" className={styles.dark}>
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <h2>Empieza en cuatro pasos</h2>
            <p>Sin instalar servidores ni contratar soporte: tu empresa queda lista apenas te registras.</p>
          </div>
          <ol className={styles.steps}>
            {steps.map((s, i) => <li key={s.title}><span className={styles.stepNum}>{i + 1}</span><h3>{s.title}</h3><p>{s.desc}</p></li>)}
          </ol>
          <div className={styles.benefits}>
            {benefits.map(({ icon: Icon, title, desc }) => <div key={title}>
              <Icon size={20} aria-hidden="true" className={styles.benefitIcon} /><h3>{title}</h3><p>{desc}</p>
            </div>)}
          </div>
        </div>
      </section>

      <section id="planes" className={styles.muted}>
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <h2>Planes según el tamaño de tu negocio</h2>
            <p>Todos incluyen catálogo, ventas, reservas, operación sin conexión y reportes. Cambia de plan cuando lo necesites.</p>
          </div>
          {planes.isLoading && <p className={styles.status}>Cargando planes…</p>}
          {planes.isError && <p className={styles.status} role="alert">No se pudieron cargar los planes. <button type="button" className={styles.linkButton} onClick={() => planes.refetch()}>Reintentar</button></p>}
          {planes.data && <div className={styles.plans}>
            {planes.data.map(p => {
              const destacado = p.codigo === 'PROFESIONAL'
              return <article key={p.codigo} className={`${styles.plan} ${destacado ? styles.planFeatured : ''}`} aria-labelledby={`plan-${p.codigo}`}>
                {destacado && <span className={styles.badge}>Recomendado</span>}
                <h3 id={`plan-${p.codigo}`}>{p.nombre}</h3>
                <p className={styles.price}><strong>Bs {p.precioReferencia.toLocaleString('es-BO')}</strong><span>/ mes</span></p>
                <ul className={styles.planList}>
                  {planItems(p).map(item => <li key={item.text} className={item.ok ? '' : styles.off}>
                    {item.ok ? <Check size={16} aria-hidden="true" /> : <Minus size={16} aria-hidden="true" />}
                    <span>{item.text}{!item.ok && <span className={styles.srOnly}> (no incluido)</span>}</span>
                  </li>)}
                </ul>
                <Link to={`/contratar?plan=${p.codigo}`} className={destacado ? styles.btnPrimary : styles.btnSecondary}>Contratar {p.nombre}</Link>
              </article>
            })}
          </div>}
          <p className={styles.note}>Precios referenciales. La contratación de esta versión es simulada, sin cobro real.</p>

          <div id="preguntas" className={styles.faq}>
            <h2>Preguntas frecuentes</h2>
            <div>
              {faqs.map(f => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.closing}>
        <div className={styles.container}>
          <h2>Tu próxima tienda abre con un clic.</h2>
          <p>Registra tu empresa y empieza a vender hoy.</p>
          <div className={styles.actions}>
            <a href="#planes" className={styles.btnPrimary}>Elegir un plan</a>
            <Link to="/login" className={styles.btnOnDark}>Ya tengo cuenta</Link>
          </div>
        </div>
      </section>
    </main>

    <footer className={styles.footer}>
      <div className={`${styles.container} ${styles.footerGrid}`}>
        <div><p className={styles.footerBrand}>FashionStore SaaS</p><p>Plataforma para negocios de moda con una o varias tiendas.</p></div>
        <div><h3>Producto</h3><ul><li><a href="#funcionalidades">Funcionalidades</a></li><li><a href="#planes">Planes</a></li><li><a href="#preguntas">Preguntas</a></li></ul></div>
        <div><h3>Cuenta</h3><ul><li><Link to="/contratar">Registrar mi empresa</Link></li><li><Link to="/login">Iniciar sesión</Link></li></ul></div>
        <div><h3>Ejemplo</h3><ul><li><Link to="/t/fashionstore">Tienda FashionStore</Link></li></ul></div>
      </div>
      <div className={styles.container}><p className={styles.copy}>© {new Date().getFullYear()} FashionStore SaaS</p></div>
    </footer>
  </div>
}
