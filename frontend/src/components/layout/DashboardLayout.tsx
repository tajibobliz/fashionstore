import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Menu, X, LogOut, Home } from 'lucide-react'
import { Brand } from '../common/Brand'
import { useAuth } from '../../hooks/useAuth'
import { dashboardConfig } from '../../features/dashboard/config'
import type { DashboardRole } from '../../features/dashboard/config'
import styles from './DashboardLayout.module.css'

export default function DashboardLayout({ role }: { role: DashboardRole }) {
 const [open, setOpen] = useState(false)
 const { user, logout } = useAuth()
 const navigate = useNavigate()
 const config = dashboardConfig[role]
 async function signOut() {
   try { await logout() } catch { /* La sesión local ya se eliminó. */ }
   navigate('/', { replace: true })
 }
 return <div className={`${styles.layout} ${styles.light} ${styles.fashion}`}>
 {open && <button className={styles.mobileOverlay} aria-label="Cerrar menú" onClick={() => setOpen(false)} />}
 <aside id="dashboard-menu" className={`${styles.sidebar} ${styles.expanded} ${open ? styles.mobileOpen : ''}`}>
 <div className={styles.brand}><Brand /><button className={styles.mobileClose} onClick={() => setOpen(false)} aria-label="Cerrar menú"><X size={18} /></button></div>
 <div className={styles.sectionLabel}>{role === 'ADMIN' ? 'Sistema' : role === 'ENCARGADO' ? 'Operación nacional' : role === 'ENCARGADO_SUCURSAL' ? 'Sucursal' : 'Mi turno'}</div>
 <nav className={styles.nav} aria-label="Menú del dashboard">{config.sections.map(({ id, label, icon: Icon, pending }) => <NavLink end to={`/dashboard/${config.slug}${id ? `/${id}` : ''}`} key={id} onClick={() => setOpen(false)} className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}><Icon size={19} aria-hidden="true" /><span>{label}</span>{pending && <span className={styles.soonDot} title="Próximamente" />}</NavLink>)}</nav>
 <div className={styles.sidebarBottom}><Link to="/" className={styles.navItem}><Home size={18} />Ver tienda</Link><button className={styles.navItem} onClick={signOut}><LogOut size={18} />Cerrar sesión</button><div className={styles.userPill}><div className={styles.userAvatar}>{(user?.nombre || user?.email || 'F')[0].toUpperCase()}</div><div className={styles.userMeta}><span className={styles.userName}>{user?.nombre || user?.email}</span><span className={styles.userRole}>{role === 'ADMIN' ? 'Administrador' : role === 'ENCARGADO' ? 'Encargado nacional' : role === 'ENCARGADO_SUCURSAL' ? 'Encargado de sucursal' : 'Cajero'}</span></div></div></div>
 </aside>
 <main className={`${styles.main} ${styles.main_expanded}`}><header className={styles.topbar}><div className={styles.topbarIntro}><button className={styles.mobileToggle} aria-label="Abrir menú" aria-expanded={open} aria-controls="dashboard-menu" onClick={() => setOpen(!open)}><Menu size={21} /></button><span className={styles.topbarEyebrow}>Fashionstore · {config.subtitle}</span><p className={styles.topbarTitle}>{config.title}</p></div><div className={styles.topbarActions}><span className={styles.roleBadge}>{role}</span></div></header><Outlet /></main>
 </div>
}
