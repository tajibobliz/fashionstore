import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, RefreshCw, Shirt, Package, Store, Users, Clock3, Search } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { dashboardConfig } from './config'
import type { DashboardRole } from './config'
import { read, useDashboardData } from './useDashboardData'
import type { Resource, Row } from './useDashboardData'
import styles from './Dashboard.module.css'
import UserRegistration from './UserRegistration'
import ManagementPage from '../management/ManagementPage'

const columns: Record<Resource, { title: string; path: string }[]> = {
 catalogo: [{ title: 'Prenda', path: 'nombre' }, { title: 'Categoría', path: 'categoria.nombre' }, { title: 'Precio (Bs)', path: 'precio' }, { title: 'Estado', path: 'estado' }],
 sucursales: [{ title: 'Sucursal', path: 'nombre' }, { title: 'Ciudad', path: 'ciudad.nombre' }, { title: 'Dirección', path: 'direccion' }, { title: 'Teléfono', path: 'telefono' }],
 inventario: [{ title: 'Prenda', path: 'variante.producto.nombre' }, { title: 'SKU', path: 'variante.sku' }, { title: 'Sucursal', path: 'sucursal.nombre' }, { title: 'Talla', path: 'variante.talla.nombre' }, { title: 'Color', path: 'variante.color.nombre' }, { title: 'Disponible', path: 'stockDisponible' }, { title: 'Reservado', path: 'stockReservado' }],
 usuarios: [{ title: 'Nombre', path: 'nombre' }, { title: 'Correo', path: 'email' }, { title: 'Rol', path: 'rol.nombre' }, { title: 'Estado', path: 'estado' }],
 proveedores: [{ title: 'Proveedor', path: 'nombre' }, { title: 'Correo', path: 'email' }, { title: 'Teléfono', path: 'telefono' }, { title: 'Estado', path: 'estado' }],
}
function sum(rows: Row[] | undefined, path: string) { return rows ? rows.reduce((total, row) => total + (Number(read(row, path)) || 0), 0) : '—' }
function distribution(rows: Row[] | undefined, group: string, value?: string) {
 const result = new Map<string, number>()
 for (const row of rows || []) { const name = read(row, group); result.set(name, (result.get(name) || 0) + (value ? Number(read(row, value)) || 0 : 1)) }
 return [...result.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
}
function Metric({ title, value, icon: Icon }: { title: string; value: string | number; icon: LucideIcon }) {
 return <article className={styles.card}><span className={styles.metricIcon}><Icon size={24} /></span><div><span className={styles.cardValue}>{value}</span><span className={styles.cardLabel}>{title}</span></div></article>
}
function Chart({ title, items, available }: { title: string; items: [string, number][]; available: boolean }) {
 const max = Math.max(1, ...items.map(item => item[1]))
 return <article className={styles.chartCard}><div className={styles.chartTitleRow}><h3>{title}</h3><span>Resumen actual</span></div>{items.length ? <div className={styles.barList}>{items.map(([name, value]) => <div className={styles.barRow} key={name}><span>{name}</span><div className={styles.barTrack}><div style={{ width: `${value / max * 100}%` }} /></div><strong>{value}</strong></div>)}</div> : <div className={styles.chartLoading}>{available ? 'Todavía no hay información para esta gráfica.' : 'Información no disponible.'}</div>}</article>
}

export default function Dashboard({ role }: { role: DashboardRole }) {
 const { section = '' } = useParams()
 const config = dashboardConfig[role]
 const current = config.sections.find(item => item.id === section)
 const registration = section === 'clientes' || section === 'cajeros'
 const { data, errors, loading, reload } = useDashboardData(role, current && !current.pending && !registration ? section : 'pending')
 const [search, setSearch] = useState('')
 const resource = section as Resource
 const rows = data[resource] || []
 const tableColumns = columns[resource] || []
 const filtered = rows.filter(row => tableColumns.some(column => read(row, column.path).toLocaleLowerCase().includes(search.toLocaleLowerCase())))
 const base = `/dashboard/${config.slug}`
 if (!current) return <section className={styles.panel}><h1>Sección no encontrada</h1><Link to={base}>Volver al dashboard</Link></section>
 if (['usuarios', 'personal', 'ciudades', 'sucursales', 'almacenes', 'cajas'].includes(section)) return <ManagementPage section={section as 'usuarios' | 'personal' | 'ciudades' | 'sucursales' | 'almacenes' | 'cajas'} />
 if (registration) return <UserRegistration key={section} cashier={section === 'cajeros'} />
 if (current.pending) return <section className={styles.panel}><span className={styles.pendingBadge}><Clock3 size={15} />Próximamente</span><h1>{current.label}</h1><p className={styles.pendingDescription}>{current.description}</p><div className={styles.chartLoading}>Esta función estará disponible próximamente en tu espacio de trabajo.</div><Link className={styles.textLink} to={base}>Volver al dashboard <ArrowRight size={16} /></Link></section>
 if (role === 'ENCARGADO_SUCURSAL') return <div className={styles.content}>
  <div className={styles.pageHeading}><div><p className={styles.kicker}>Operación territorial</p><h1>Panel de Sucursal</h1><p>Accede a las herramientas disponibles para las sucursales que tienes asignadas.</p></div></div>
  <section className={styles.dashboardSection}><div className={styles.sectionHeading}><div><h2>Gestión de Sucursal</h2><p>Los módulos operativos se habilitarán progresivamente.</p></div></div><div className={styles.actionGrid}>{config.sections.filter(item => item.id).map(({ id, label, icon: Icon, description }) => <Link className={styles.actionCard} key={id} to={`${base}/${id}`}><Icon size={24} /><span>{label}</span><small>Próximamente</small>{description && <p>{description}</p>}<ArrowRight size={16} /></Link>)}</div></section>
 </div>
 return <div className={styles.content}>
 <div className={styles.pageHeading}><div><p className={styles.kicker}>{role === 'ADMIN' ? 'Control de la plataforma' : role === 'ENCARGADO' ? 'Operación nacional' : 'Tu espacio de atención'}</p><h1>{section ? current.label : `Dashboard ${role === 'ADMIN' ? 'ADMIN' : role === 'ENCARGADO' ? 'ENCARGADO' : 'CAJERO'}`}</h1><p>{role === 'ADMIN' ? 'Supervisa los usuarios, las prendas y las existencias del sistema.' : role === 'ENCARGADO' ? 'Coordina sucursales, inventario y equipo de Fashionstore desde un solo espacio.' : 'Encuentra las prendas y consulta las existencias para atender a tus clientas.'}</p></div><button className={styles.refreshButton} onClick={reload} disabled={loading}><RefreshCw size={16} />Actualizar</button></div>
 {Object.entries(errors).map(([name, error]) => <p className={styles.errorNotice} role="alert" key={name}>{name}: {error}</p>)}
 {loading ? <div className={styles.chartLoading} role="status">Cargando tu dashboard…</div> : section ? <section className={styles.panel}><div className={styles.panelHeader}><h2>{current.label}</h2><span className={styles.panelCount}>{rows.length} registros</span></div><label className={styles.searchField}><Search size={16} /><input aria-label={`Buscar ${current.label}`} placeholder="Buscar…" value={search} onChange={event => setSearch(event.target.value)} /></label>{errors[resource] ? <p className={styles.emptyState}>No se pudo cargar esta sección. Usa Actualizar para reintentar.</p> : filtered.length ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr>{tableColumns.map(column => <th key={column.path}>{column.title}</th>)}</tr></thead><tbody>{filtered.map((row, index) => <tr key={index}>{tableColumns.map(column => <td key={column.path}>{column.path === 'estado' ? row.estado ? 'Activo' : 'Inactivo' : read(row, column.path)}</td>)}</tr>)}</tbody></table></div> : <p className={styles.emptyState}>{search ? 'No se encontraron coincidencias.' : 'Todavía no hay registros disponibles.'}</p>}</section> : <>
 <section className={styles.dashboardSection}><div className={styles.sectionHeading}><div><h2>Resumen de Fashionstore</h2><p>Información actual del catálogo y el inventario registrado.</p></div></div><div className={styles.cards}><Metric title="Prendas en catálogo" value={data.catalogo?.length ?? '—'} icon={Shirt} /><Metric title={role === 'ADMIN' ? 'Usuarios registrados' : 'Registros de inventario'} value={role === 'ADMIN' ? data.usuarios?.length ?? '—' : data.inventario?.length ?? '—'} icon={role === 'ADMIN' ? Users : Package} /><Metric title="Unidades disponibles" value={sum(data.inventario, 'stockDisponible')} icon={Package} /><Metric title={role === 'ADMIN' ? 'Sucursales' : 'Unidades reservadas'} value={role === 'ADMIN' ? data.sucursales?.length ?? '—' : sum(data.inventario, 'stockReservado')} icon={Store} /></div></section>
 <section className={styles.dashboardSection}><div className={styles.sectionHeading}><div><h2>{role === 'ADMIN' ? 'Accesos de administración' : role === 'ENCARGADO' ? 'Operación nacional' : 'Atención y caja'}</h2><p>{role === 'ADMIN' ? 'Gestiona la información disponible en el sistema.' : 'Accede a las herramientas de tu rol y conoce lo que viene.'}</p></div></div><div className={styles.actionGrid}>{config.sections.filter(item => item.id).slice(0, role === 'ENCARGADO' ? 5 : 4).map(({ id, label, icon: Icon, pending, description }) => <Link className={styles.actionCard} key={id} to={`${base}/${id}`}><Icon size={24} /><span>{label}</span><small>{pending ? 'Próximamente' : 'Consultar información'}</small>{description && <p>{description}</p>}<ArrowRight size={16} /></Link>)}</div></section>
 <section className={styles.dashboardSection}><div className={styles.chartsGrid}><Chart title="Prendas por categoría" items={distribution(data.catalogo, 'categoria.nombre')} available={!!data.catalogo} /><Chart title="Stock disponible por sucursal" items={distribution(data.inventario, 'sucursal.nombre', 'stockDisponible')} available={!!data.inventario} /></div></section>
 <section className={styles.panel}><div className={styles.panelHeader}><div><h2>{role === 'ADMIN' ? 'Estado de la plataforma' : role === 'ENCARGADO' ? 'Prepara tu operación nacional' : 'Antes de empezar tu turno'}</h2><p>{role === 'ADMIN' ? 'Las herramientas de supervisión global se ampliarán progresivamente.' : role === 'ENCARGADO' ? 'La gestión de puntos de venta y cajas se habilitará próximamente.' : 'Asignación de caja y cobros: próximamente.'}</p></div><span className={styles.pendingBadge}>En desarrollo</span></div><Link to={`${base}/inventario`} className={styles.textLink}>Consultar inventario <ArrowRight size={16} /></Link></section>
 </>}
 </div>
}
