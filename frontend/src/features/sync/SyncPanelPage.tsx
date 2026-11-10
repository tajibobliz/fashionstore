import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, CloudOff, KeyRound, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { syncApi } from '../../api/sync.api'
import type { OperacionPanel, TipoConflicto } from '../../api/sync.api'
import { catalogApi } from '../../api/catalog.api'
import { queryKeys } from '../../api/queryKeys'
import { getApiErrorMessage } from '../../utils/apiError'
import dashboardStyles from '../dashboard/Dashboard.module.css'
import styles from './SyncPanel.module.css'
import { formatMoney } from '../../utils/money'
import { tenantApi } from '../../api/tenant.api'
import { authApi } from '../auth/auth.api'
import { useAuth } from '../../hooks/useAuth'

const CONFLICTO: Record<TipoConflicto, string> = {
  STOCK: 'Faltó stock',
  SIN_STOCK: 'Reserva sin stock',
  PRECIO: 'Precio distinto',
  TURNO_CERRADO: 'Turno cerrado',
}
/**
 * Plazo del acceso sin conexión con PIN (CU17): cuántas horas desde su última conexión puede un
 * cajero, encargado de sucursal o clienta seguir operando sin internet. Solo el ADMIN lo cambia.
 */
function PlazoSesionOffline() {
  const { user } = useAuth()
  const client = useQueryClient()
  const perfil = useQuery({ queryKey: ['auth', 'perfil'], queryFn: authApi.profile, staleTime: 60_000 })
  const actual = perfil.data?.empresa?.horasSesionOffline ?? 72
  const [valor, setValor] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const guardar = useMutation({
    mutationFn: () => tenantApi.cambiarSesionOffline(Number(valor)),
    onSuccess: async r => {
      setValor(null)
      setAviso({ ok: true, texto: `Listo: ${r.horasSesionOffline} h. Cada usuario lo toma la próxima vez que se conecte.` })
      await client.invalidateQueries({ queryKey: ['auth', 'perfil'] })
    },
    onError: e => setAviso({ ok: false, texto: getApiErrorMessage(e) }),
  })
  const esAdmin = user?.rol === 'ADMIN'
  return <div className={styles.plazo}>
    <KeyRound size={20} aria-hidden="true" />
    <div>
      <strong>Acceso sin conexión con PIN</strong>
      <p>Cajeros, encargados de sucursal y clientas pueden activar un PIN para entrar sin internet. Pueden operar hasta <strong>{actual} h</strong> desde su última conexión; después, sin internet solo consultan.</p>
      {esAdmin && <form className={styles.plazoForm} onSubmit={e => { e.preventDefault(); guardar.mutate() }}>
        <label htmlFor="horas-offline">Plazo (horas)</label>
        <input id="horas-offline" type="number" min={1} max={720} step={1} value={valor ?? actual} onChange={e => { setValor(e.target.value); setAviso(null) }} />
        <button type="submit" disabled={valor === null || Number(valor) === actual || guardar.isPending}>{guardar.isPending ? 'Guardando…' : 'Guardar'}</button>
        <small>Entre 1 hora y 720 (30 días).</small>
      </form>}
      {aviso && <p className={aviso.ok ? styles.plazoOk : styles.plazoError} role={aviso.ok ? 'status' : 'alert'}>{aviso.texto}</p>}
    </div>
  </div>
}

const fecha = (iso: string) => new Date(iso).toLocaleString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

/**
 * Panel de sincronización (Fase 2, tarea 2.2): ventas y reservas hechas sin conexión que el
 * servidor confirmó con conflicto o rechazó. El encargado revisa, corrige (p. ej. un ajuste de
 * inventario) y deja una nota para marcarlas como resueltas.
 */
export default function SyncPanelPage() {
  const client = useQueryClient()
  const [pendientes, setPendientes] = useState(true)
  const resumen = useQuery({ queryKey: ['sync', 'resumen'], queryFn: syncApi.resumen })
  const lista = useQuery({ queryKey: ['sync', 'operaciones', pendientes], queryFn: () => syncApi.operaciones(pendientes) })
  const variantes = useQuery({ queryKey: queryKeys.catalog.variants, queryFn: catalogApi.variants.list })
  const nombres = useMemo(() => new Map((variantes.data ?? []).map(v => [
    v.idVariante,
    `${v.producto?.nombre ?? 'Prenda'} (${[v.talla?.nombre, v.color?.nombre].filter(Boolean).join(' / ') || v.sku})`,
  ])), [variantes.data])
  const refrescar = () => client.invalidateQueries({ queryKey: ['sync'] })

  return <section className={dashboardStyles.content}>
    <div className={dashboardStyles.pageHeading}><div>
      <p className={dashboardStyles.kicker}>Operación sin conexión</p>
      <h1>Sincronización offline</h1>
      <p>Ventas y reservas que llegaron desde dispositivos sin internet. Revisa los conflictos y márcalos como resueltos.</p>
    </div></div>

    {resumen.data && <div className={dashboardStyles.cards}>
      <Metric icon={AlertTriangle} value={resumen.data.pendientes} label="Por revisar" />
      <Metric icon={CheckCircle2} value={resumen.data.ultimas24h.confirmadas} label="Confirmadas (24 h)" />
      <Metric icon={CloudOff} value={resumen.data.ultimas24h.conflictos} label="Con conflicto (24 h)" />
      <Metric icon={XCircle} value={resumen.data.ultimas24h.rechazadas} label="Rechazadas (24 h)" />
    </div>}

    <PlazoSesionOffline />

    <div className={styles.filters} role="group" aria-label="Filtro">
      <button type="button" aria-pressed={pendientes} onClick={() => setPendientes(true)}>Por revisar</button>
      <button type="button" aria-pressed={!pendientes} onClick={() => setPendientes(false)}>Todas</button>
    </div>

    {lista.isLoading && <div className={dashboardStyles.chartLoading} role="status">Cargando operaciones…</div>}
    {lista.error && <p className={dashboardStyles.errorNotice} role="alert">{getApiErrorMessage(lista.error)}</p>}
    {lista.data && (lista.data.length
      ? <div className={styles.list}>{lista.data.map(op => <Operacion key={op.idOperacionSync} op={op} nombres={nombres} onResuelta={refrescar} />)}</div>
      : <p className={dashboardStyles.emptyState}>{pendientes ? 'No hay conflictos por revisar.' : 'Todavía no llegaron operaciones offline.'}</p>)}
  </section>
}

function Metric({ icon: Icon, value, label }: { icon: LucideIcon; value: number; label: string }) {
  return <article className={dashboardStyles.card}><span className={dashboardStyles.metricIcon}><Icon size={22} aria-hidden="true" /></span><div><span className={dashboardStyles.cardValue}>{value}</span><span className={dashboardStyles.cardLabel}>{label}</span></div></article>
}

function Operacion({ op, nombres, onResuelta }: { op: OperacionPanel; nombres: Map<number, string>; onResuelta: () => void }) {
  const [nota, setNota] = useState('')
  const resolver = useMutation({ mutationFn: () => syncApi.resolver(op.idOperacionSync, nota.trim()), onSuccess: onResuelta })
  const estadoClase = op.estado === 'CONFIRMADA' ? styles.ok : op.estado === 'CONFLICTO' ? styles.warn : styles.bad
  const titulo = `${op.tipo === 'VENTA' ? 'Venta' : 'Reserva'}${op.serverId ? ` #${op.serverId}` : ''} · ${op.sucursal?.nombre ?? 'Sucursal'}`

  return <article className={styles.op}>
    <div className={styles.opHead}>
      <h3>{titulo}</h3>
      <div className={styles.tags}>
        <span className={`${styles.tag} ${estadoClase}`}>{op.estado}</span>
        {op.conflictos.map(c => <span key={c} className={`${styles.tag} ${styles.neutral}`}>{CONFLICTO[c]}</span>)}
      </div>
    </div>
    <p className={styles.meta}>
      {op.usuario?.nombre ?? 'Usuario'}{op.usuario?.rol ? ` (${op.usuario.rol})` : ''} · hecha en el dispositivo {fecha(op.creadaLocalEn)} · recibida {fecha(op.recibidaEn)}
      {op.intentos > 1 ? ` · ${op.intentos} envíos` : ''}
    </p>
    {op.motivo && <p className={`${styles.reason} ${op.estado === 'RECHAZADA' ? styles.reasonBad : ''}`}>{op.motivo}</p>}
    {op.detalle?.items.length ? <ul className={styles.items}>{op.detalle.items.map(i => <li key={i.idVariante}>
      <span>{i.cantidad} × {nombres.get(i.idVariante) ?? `variante #${i.idVariante}`}</span>
      {i.precioLocal !== undefined && <small>cobrado {formatMoney(i.precioLocal)}{i.precioServidor !== undefined ? ` · vigente ${formatMoney(i.precioServidor)}` : ''}</small>}
      {i.faltante ? <small>faltante: {i.faltante}</small> : null}
    </li>)}</ul> : null}
    {op.detalle?.alternativas?.length ? <p className={styles.meta}>Alternativas ofrecidas: {[...new Set(op.detalle.alternativas.map(a => `${a.sucursal} (${a.stock})`))].join(', ')}</p> : null}

    {op.estado !== 'CONFIRMADA' && (op.resuelta
      ? <p className={styles.resolved}>Resuelto {op.resueltaEn ? fecha(op.resueltaEn) : ''}: {op.notaResolucion}</p>
      : <form className={styles.resolve} onSubmit={e => { e.preventDefault(); resolver.mutate() }}>
        <label>Qué se hizo para resolverlo
          <textarea value={nota} onChange={e => setNota(e.target.value)} maxLength={300} placeholder="Ej. Ajuste de inventario +1: la prenda estaba en depósito" required minLength={3} />
        </label>
        {resolver.error && <p className={dashboardStyles.errorNotice} role="alert">{getApiErrorMessage(resolver.error)}</p>}
        <button type="submit" disabled={nota.trim().length < 3 || resolver.isPending}>{resolver.isPending ? 'Guardando…' : 'Marcar como resuelto'}</button>
      </form>)}
  </article>
}
