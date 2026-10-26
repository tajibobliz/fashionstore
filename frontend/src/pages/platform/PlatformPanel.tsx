import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, LayoutGrid, Layers, LogOut, Plus, RefreshCw, Search, X } from 'lucide-react'
import { platformApi } from '../../api/platform.api'
import type { PlanAdmin } from '../../api/platform.api'
import { slugify } from '../../api/saas.api'
import type { CodigoPlan } from '../../api/saas.api'
import type { TenantResumen } from '../../api/tenant.api'
import { useAuth } from '../../hooks/useAuth'
import { getApiErrorMessage } from '../../utils/apiError'
import { formatoFecha } from '../../features/plan/format'
import styles from './PlatformPanel.module.css'

const EMPRESAS_KEY = ['platform', 'empresas'] as const
const PLANES_KEY = ['platform', 'planes'] as const
const CODIGOS: CodigoPlan[] = ['BASICO', 'PROFESIONAL', 'EMPRESARIAL']

/** Panel del SUPER_ADMIN: empresas contratantes, suscripciones y planes (enunciado §9.3–9.5). */
export default function PlatformPanel() {
  const { tab = 'empresas' } = useParams()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function salir() {
    try { await logout() } catch { /* la sesión local ya se cerró */ }
    navigate('/', { replace: true })
  }

  return <div className={styles.page}>
    <header className={styles.top}>
      <Link to="/" className={styles.brand} aria-label="FashionStore SaaS, inicio"><LayoutGrid size={20} aria-hidden="true" />FashionStore<span>SaaS</span></Link>
      <nav className={styles.tabs} aria-label="Secciones de la plataforma">
        <NavLink to="/plataforma/empresas" className={({ isActive }) => isActive ? styles.tabActive : ''}><Building2 size={16} aria-hidden="true" /> Empresas</NavLink>
        <NavLink to="/plataforma/planes" className={({ isActive }) => isActive ? styles.tabActive : ''}><Layers size={16} aria-hidden="true" /> Planes</NavLink>
      </nav>
      <div className={styles.user}>
        <span>{user?.email}</span>
        <button type="button" className={styles.btnGhost} onClick={salir}><LogOut size={15} aria-hidden="true" /> Salir</button>
      </div>
    </header>
    <main className={styles.main}>
      {tab === 'planes' ? <PlanesTab /> : <EmpresasTab />}
    </main>
  </div>
}

/* ======================= Empresas ======================= */

function EmpresasTab() {
  const empresas = useQuery({ queryKey: EMPRESAS_KEY, queryFn: platformApi.empresas })
  const [buscar, setBuscar] = useState('')
  const [seleccion, setSeleccion] = useState<number | null>(null)
  const [creando, setCreando] = useState(false)

  const filtradas = useMemo(() => (empresas.data ?? []).filter(e =>
    `${e.empresa.nombre} ${e.empresa.slug}`.toLowerCase().includes(buscar.toLowerCase())), [empresas.data, buscar])
  const actual = empresas.data?.find(e => e.empresa.idEmpresa === seleccion) ?? null
  const resumen = useMemo(() => {
    const lista = empresas.data ?? []
    return {
      total: lista.length,
      activas: lista.filter(e => e.empresa.estado === 'ACTIVA' && e.suscripcion.estado === 'ACTIVA').length,
      vencidas: lista.filter(e => e.suscripcion.estado !== 'ACTIVA').length,
      suspendidas: lista.filter(e => e.empresa.estado === 'SUSPENDIDA').length,
    }
  }, [empresas.data])

  return <>
    <div className={styles.head}>
      <div><h1>Empresas</h1><p className={styles.muted}>Negocios que contrataron la plataforma, su plan y su uso.</p></div>
      <div className={styles.headActions}>
        <button type="button" className={styles.btnGhost} onClick={() => empresas.refetch()} disabled={empresas.isFetching}><RefreshCw size={15} aria-hidden="true" /> Actualizar</button>
        <button type="button" className={styles.btnPrimary} onClick={() => { setSeleccion(null); setCreando(true) }}><Plus size={16} aria-hidden="true" /> Registrar empresa</button>
      </div>
    </div>

    <dl className={styles.stats}>
      <div><dt>Empresas</dt><dd>{resumen.total}</dd></div>
      <div><dt>Operando</dt><dd>{resumen.activas}</dd></div>
      <div><dt>Suscripción vencida</dt><dd>{resumen.vencidas}</dd></div>
      <div><dt>Suspendidas</dt><dd>{resumen.suspendidas}</dd></div>
    </dl>

    <label className={styles.search}><Search size={16} aria-hidden="true" /><input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar por nombre o slug" aria-label="Buscar empresa" /></label>

    {empresas.isLoading && <p role="status">Cargando empresas…</p>}
    {empresas.isError && <p className={styles.error} role="alert">{getApiErrorMessage(empresas.error)}</p>}
    {empresas.data && <div className={styles.tableWrap}><table className={styles.table}>
      <thead><tr><th>Empresa</th><th>Plan</th><th>Suscripción</th><th>Sucursales</th><th>Empleados</th><th>Estado</th><th><span className={styles.srOnly}>Acciones</span></th></tr></thead>
      <tbody>{filtradas.map(e => <tr key={e.empresa.idEmpresa} className={e.empresa.idEmpresa === seleccion ? styles.rowActive : ''}>
        <td><strong>{e.empresa.nombre}</strong><span className={styles.sub}>/t/{e.empresa.slug}</span></td>
        <td>{e.plan?.nombre ?? '—'}</td>
        <td><EstadoSuscripcion r={e} /></td>
        <td>{uso(e.limites.sucursales.usadas, e.limites.sucursales.maximo)}</td>
        <td>{uso(e.limites.usuarios.usados, e.limites.usuarios.maximo)}</td>
        <td><span className={`${styles.pill} ${e.empresa.estado === 'ACTIVA' ? styles.pillOk : styles.pillBad}`}>{e.empresa.estado === 'ACTIVA' ? 'Activa' : 'Suspendida'}</span></td>
        <td><button type="button" className={styles.linkBtn} onClick={() => { setCreando(false); setSeleccion(e.empresa.idEmpresa) }}>Gestionar</button></td>
      </tr>)}
      {!filtradas.length && <tr><td colSpan={7} className={styles.empty}>Sin resultados.</td></tr>}
      </tbody>
    </table></div>}

    {creando && <NuevaEmpresa onClose={() => setCreando(false)} onCreated={id => { setCreando(false); setSeleccion(id) }} />}
    {actual && <DetalleEmpresa key={actual.empresa.idEmpresa} r={actual} onClose={() => setSeleccion(null)} />}
  </>
}

function uso(usados: number, maximo: number | null) {
  return <span className={maximo != null && usados >= maximo ? styles.atLimit : ''}>{usados} / {maximo ?? '∞'}</span>
}

function EstadoSuscripcion({ r }: { r: TenantResumen }) {
  const s = r.suscripcion
  if (s.estado !== 'ACTIVA') return <span className={`${styles.pill} ${styles.pillBad}`}>{s.estado === 'VENCIDA' ? 'Vencida' : 'Sin plan'}</span>
  const pronto = s.diasRestantes != null && s.diasRestantes <= 7
  return <span className={`${styles.pill} ${pronto ? styles.pillWarn : styles.pillOk}`}>{s.diasRestantes} días</span>
}

function DetalleEmpresa({ r, onClose }: { r: TenantResumen; onClose: () => void }) {
  const qc = useQueryClient()
  const id = r.empresa.idEmpresa
  const historial = useQuery({ queryKey: ['platform', 'historial', id], queryFn: () => platformApi.historial(id) })
  const [plan, setPlan] = useState<CodigoPlan>(r.plan?.codigo ?? 'BASICO')
  const [meses, setMeses] = useState(1)
  const [vence, setVence] = useState(r.suscripcion.fechaVencimiento ?? '')
  const [mensaje, setMensaje] = useState('')

  const refrescar = (texto: string) => {
    void qc.invalidateQueries({ queryKey: EMPRESAS_KEY })
    void qc.invalidateQueries({ queryKey: ['platform', 'historial', id] })
    setMensaje(texto)
  }
  const cambiarPlan = useMutation({ mutationFn: () => platformApi.cambiarPlan(id, plan, meses), onSuccess: d => refrescar(`Plan ${d.plan?.nombre} asignado hasta el ${formatoFecha(d.suscripcion.fechaVencimiento ?? '')}.`) })
  const estado = useMutation({ mutationFn: (e: 'ACTIVA' | 'SUSPENDIDA') => platformApi.cambiarEstado(id, e), onSuccess: d => refrescar(d.empresa.estado === 'ACTIVA' ? 'Empresa activada.' : 'Empresa suspendida: sus usuarios no pueden iniciar sesión ni operar.') })
  const vencimiento = useMutation({ mutationFn: () => platformApi.fijarVencimiento(id, vence), onSuccess: () => refrescar('Fecha de vencimiento actualizada.') })
  const error = cambiarPlan.error ?? estado.error ?? vencimiento.error

  return <aside className={styles.drawer} aria-labelledby="detalle-titulo">
    <div className={styles.drawerHead}>
      <div><h2 id="detalle-titulo">{r.empresa.nombre}</h2><p className={styles.muted}>/t/{r.empresa.slug} · id {id}</p></div>
      <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
    </div>
    {mensaje && <p className={styles.success} role="status">{mensaje}</p>}
    {error && <p className={styles.error} role="alert">{getApiErrorMessage(error)}</p>}

    <section className={styles.block}>
      <h3>Suscripción</h3>
      <p>{r.plan?.nombre ?? 'Sin plan'} · <EstadoSuscripcion r={r} />{r.suscripcion.fechaVencimiento && <> · vence el {formatoFecha(r.suscripcion.fechaVencimiento)}</>}</p>
      <div className={styles.inline}>
        <label>Plan<select value={plan} onChange={e => setPlan(e.target.value as CodigoPlan)}>{CODIGOS.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
        <label>Meses<input type="number" min={1} max={36} value={meses} onChange={e => setMeses(Number(e.target.value) || 1)} /></label>
        <button type="button" className={styles.btnPrimary} disabled={cambiarPlan.isPending} onClick={() => cambiarPlan.mutate()}>{plan === r.plan?.codigo ? 'Renovar' : 'Cambiar plan'}</button>
      </div>
      <p className={styles.muted}>La suscripción actual queda en el historial como "Reemplazada" y la nueva empieza hoy.</p>
    </section>

    <section className={styles.block}>
      <h3>Simular vencimiento</h3>
      <div className={styles.inline}>
        <label>Vence el<input type="date" value={vence} onChange={e => setVence(e.target.value)} /></label>
        <button type="button" className={styles.btnGhost} disabled={!vence || vencimiento.isPending} onClick={() => vencimiento.mutate()}>Guardar fecha</button>
      </div>
      <p className={styles.muted}>Para pruebas y la defensa: con una fecha pasada la empresa queda en solo lectura.</p>
    </section>

    <section className={styles.block}>
      <h3>Estado de la empresa</h3>
      {r.empresa.estado === 'ACTIVA'
        ? <button type="button" className={styles.btnDanger} disabled={estado.isPending} onClick={() => estado.mutate('SUSPENDIDA')}>Suspender empresa</button>
        : <button type="button" className={styles.btnPrimary} disabled={estado.isPending} onClick={() => estado.mutate('ACTIVA')}>Reactivar empresa</button>}
    </section>

    <section className={styles.block}>
      <h3>Historial</h3>
      {historial.data?.length ? <ul className={styles.history}>{historial.data.map(h => <li key={h.idSuscripcion}>
        <strong>{h.plan.nombre}</strong> {formatoFecha(h.fechaInicio)} → {formatoFecha(h.fechaVencimiento)} <span className={styles.muted}>({h.estado === 'CANCELADA' ? 'Reemplazada' : h.estado === 'ACTIVA' ? 'Activa' : 'Vencida'})</span>
      </li>)}</ul> : <p className={styles.muted}>{historial.isLoading ? 'Cargando…' : 'Sin registros.'}</p>}
    </section>
  </aside>
}

function NuevaEmpresa({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const qc = useQueryClient()
  const [f, setF] = useState({ nombre: '', slug: '', nit: '', codigoPlan: 'BASICO' as CodigoPlan, meses: 1, adminNombre: '', adminEmail: '', adminPassword: '' })
  const [slugTocado, setSlugTocado] = useState(false)
  const slug = slugTocado ? f.slug : slugify(f.nombre)
  const crear = useMutation({
    mutationFn: () => platformApi.crearEmpresa({
      nombre: f.nombre.trim(), slug, nit: f.nit.trim() || undefined, codigoPlan: f.codigoPlan, meses: f.meses,
      admin: { nombre: f.adminNombre.trim(), email: f.adminEmail.trim(), password: f.adminPassword },
    }),
    onSuccess: d => { void qc.invalidateQueries({ queryKey: EMPRESAS_KEY }); onCreated(d.empresa.idEmpresa) },
  })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(v => ({ ...v, [k]: k === 'meses' ? Number(e.target.value) || 1 : e.target.value }))
  const enviar = (e: FormEvent) => { e.preventDefault(); crear.mutate() }

  return <aside className={styles.drawer} aria-labelledby="nueva-titulo">
    <div className={styles.drawerHead}>
      <div><h2 id="nueva-titulo">Registrar empresa</h2><p className={styles.muted}>Crea la empresa, su suscripción y su administrador.</p></div>
      <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
    </div>
    {crear.isError && <p className={styles.error} role="alert">{getApiErrorMessage(crear.error)}</p>}
    <form className={styles.form} onSubmit={enviar}>
      <label>Nombre comercial<input value={f.nombre} onChange={set('nombre')} required maxLength={150} /></label>
      <label>Slug (dirección /t/…)<input value={slug} onChange={e => { setSlugTocado(true); setF(v => ({ ...v, slug: slugify(e.target.value) })) }} required minLength={3} maxLength={60} /></label>
      <label>NIT (opcional)<input value={f.nit} onChange={set('nit')} maxLength={30} /></label>
      <div className={styles.inline}>
        <label>Plan<select value={f.codigoPlan} onChange={set('codigoPlan')}>{CODIGOS.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
        <label>Meses<input type="number" min={1} max={36} value={f.meses} onChange={set('meses')} /></label>
      </div>
      <h3>Administrador</h3>
      <label>Nombre<input value={f.adminNombre} onChange={set('adminNombre')} required maxLength={100} /></label>
      <label>Correo<input type="email" value={f.adminEmail} onChange={set('adminEmail')} required /></label>
      <label>Contraseña inicial<input type="password" value={f.adminPassword} onChange={set('adminPassword')} required minLength={6} autoComplete="new-password" /></label>
      <button type="submit" className={styles.btnPrimary} disabled={crear.isPending}>{crear.isPending ? 'Creando…' : 'Registrar empresa'}</button>
    </form>
  </aside>
}

/* ======================= Planes ======================= */

function PlanesTab() {
  const planes = useQuery({ queryKey: PLANES_KEY, queryFn: platformApi.planes })
  return <>
    <div className={styles.head}>
      <div><h1>Planes</h1><p className={styles.muted}>Límites y funcionalidades de cada plan. Los cambios se aplican al instante a todas las empresas con ese plan y a la página pública. Deja el límite vacío para "ilimitado".</p></div>
    </div>
    {planes.isLoading && <p role="status">Cargando planes…</p>}
    {planes.isError && <p className={styles.error} role="alert">{getApiErrorMessage(planes.error)}</p>}
    <div className={styles.planGrid}>{planes.data?.map(p => <PlanEditor key={`${p.idPlan}-${p.maxSucursales}-${p.maxUsuarios}-${p.precioReferencia}-${p.activo}-${p.features.aiReports}-${p.features.ml}`} plan={p} />)}</div>
  </>
}

function PlanEditor({ plan }: { plan: PlanAdmin }) {
  const qc = useQueryClient()
  const [v, setV] = useState({
    maxSucursales: plan.maxSucursales?.toString() ?? '',
    maxUsuarios: plan.maxUsuarios?.toString() ?? '',
    precio: String(Number(plan.precioReferencia)),
    aiReports: !!plan.features.aiReports,
    ml: !!plan.features.ml,
    activo: plan.activo,
  })
  const [ok, setOk] = useState(false)
  const guardar = useMutation({
    mutationFn: () => platformApi.actualizarPlan(plan.idPlan, {
      maxSucursales: v.maxSucursales === '' ? null : Number(v.maxSucursales),
      maxUsuarios: v.maxUsuarios === '' ? null : Number(v.maxUsuarios),
      precioReferencia: Number(v.precio) || 0,
      features: { aiReports: v.aiReports, ml: v.ml },
      activo: v.activo,
    }),
    onSuccess: () => {
      setOk(true)
      void qc.invalidateQueries({ queryKey: PLANES_KEY })
      void qc.invalidateQueries({ queryKey: EMPRESAS_KEY })
      void qc.invalidateQueries({ queryKey: ['saas', 'planes'] })
    },
  })
  const cambiar = (patch: Partial<typeof v>) => { setOk(false); setV(x => ({ ...x, ...patch })) }

  return <form className={styles.planCard} onSubmit={e => { e.preventDefault(); guardar.mutate() }} aria-label={`Plan ${plan.nombre}`}>
    <div className={styles.planTop}><h2>{plan.nombre}</h2><span className={styles.code}>{plan.codigo}</span></div>
    <label>Sucursales activas<input type="number" min={0} value={v.maxSucursales} placeholder="Ilimitado" onChange={e => cambiar({ maxSucursales: e.target.value })} /></label>
    <label>Empleados activos<input type="number" min={0} value={v.maxUsuarios} placeholder="Ilimitado" onChange={e => cambiar({ maxUsuarios: e.target.value })} /></label>
    <label>Precio referencial (Bs/mes)<input type="number" min={0} step="1" value={v.precio} onChange={e => cambiar({ precio: e.target.value })} /></label>
    <label className={styles.check}><input type="checkbox" checked={v.aiReports} onChange={e => cambiar({ aiReports: e.target.checked })} /> Reportes con IA y por voz</label>
    <label className={styles.check}><input type="checkbox" checked={v.ml} onChange={e => cambiar({ ml: e.target.checked })} /> Analítica con Machine Learning</label>
    <label className={styles.check}><input type="checkbox" checked={v.activo} onChange={e => cambiar({ activo: e.target.checked })} /> Disponible para contratar</label>
    {guardar.isError && <p className={styles.error} role="alert">{getApiErrorMessage(guardar.error)}</p>}
    {ok && <p className={styles.success} role="status">Guardado.</p>}
    <button type="submit" className={styles.btnPrimary} disabled={guardar.isPending}>{guardar.isPending ? 'Guardando…' : 'Guardar cambios'}</button>
  </form>
}
