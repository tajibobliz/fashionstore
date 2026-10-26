import { useState } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useOnline } from '../../offline/network'
import { useOperacionesPropias, descartar, limpiarConfirmadas } from '../../offline/queue'
import { sincronizar, useEstadoSync } from '../../offline/sync'
import type { EstadoLocal, OperacionLocal } from '../../offline/db'
import styles from './Offline.module.css'

const ETIQUETA: Record<EstadoLocal, string> = {
  PENDIENTE: 'Pendiente', ENVIANDO: 'Enviando', CONFIRMADA: 'Confirmada', CONFLICTO: 'Conflicto', RECHAZADA: 'Rechazada',
}
const BADGE: Record<EstadoLocal, string> = {
  PENDIENTE: styles.badgePendiente, ENVIANDO: styles.badgeEnviando, CONFIRMADA: styles.badgeConfirmada,
  CONFLICTO: styles.badgeConflicto, RECHAZADA: styles.badgeRechazada,
}
const hora = (iso: string) => new Date(iso).toLocaleString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

/**
 * Indicador flotante de conexión + lista de operaciones guardadas en este dispositivo.
 * Se muestra si no hay conexión o si hay algo pendiente o con aviso.
 */
export default function OfflineIndicator() {
  const { user } = useAuth()
  const online = useOnline()
  const sync = useEstadoSync()
  const ops = useOperacionesPropias(user?.idEmpresa, user?.idUsuario)
  const [abierto, setAbierto] = useState(false)

  if (!user?.idEmpresa) return null
  const pendientes = ops.filter(o => o.estado === 'PENDIENTE' || o.estado === 'ENVIANDO').length
  const avisos = ops.filter(o => o.estado === 'CONFLICTO' || o.estado === 'RECHAZADA').length
  if (online && !pendientes && !avisos && !abierto && !ops.length) return null

  const dot = !online ? styles.dotOffline : sync.sincronizando ? styles.dotBusy : pendientes || avisos ? styles.dotWarn : ''
  const texto = !online ? 'Sin conexión' : sync.sincronizando ? 'Sincronizando…' : pendientes ? 'Por enviar' : avisos ? 'Revisar' : 'Sincronizado'
  const numero = pendientes || avisos

  return <>
    <button type="button" className={styles.chip} onClick={() => setAbierto(true)} aria-haspopup="dialog" aria-expanded={abierto}>
      <span className={`${styles.dot} ${dot}`} aria-hidden="true" />
      {texto}
      {numero > 0 && <span className={styles.count}>{numero}</span>}
    </button>
    {abierto && <>
      <button type="button" className={styles.backdrop} aria-label="Cerrar" onClick={() => setAbierto(false)} />
      <section className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="offline-title">
        <div className={styles.drawerHead}>
          <div>
            <h2 id="offline-title">Operaciones de este dispositivo</h2>
            <p>{online ? 'Con conexión' : 'Sin conexión: se envían al volver la red'}{sync.ultimaSync ? ` · última sincronización ${hora(sync.ultimaSync)}` : ''}</p>
          </div>
          <button type="button" className={styles.close} onClick={() => setAbierto(false)} aria-label="Cerrar"><X size={16} /></button>
        </div>
        {sync.error
          ? <p className={`${styles.status} ${styles.statusError}`} role="status">{sync.error}{sync.proximoIntento ? ` Reintento automático a las ${new Date(sync.proximoIntento).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.` : ''}</p>
          : <p className={styles.status}>Las ventas y reservas hechas sin conexión se guardan aquí y se envían solas. Reenviar es seguro: el servidor no las duplica.</p>}
        <ul className={styles.list} aria-live="polite">
          {ops.length ? ops.map(op => <Item key={op.operationId} op={op} />) : <p className={styles.empty}>No hay operaciones guardadas.</p>}
        </ul>
        <div className={styles.foot}>
          <button type="button" className={styles.ghost} onClick={() => void limpiarConfirmadas(user.idEmpresa!, user.idUsuario)} disabled={!ops.some(o => o.estado === 'CONFIRMADA')}>Limpiar confirmadas</button>
          <button type="button" className={styles.primary} disabled={!online || !pendientes || sync.sincronizando} onClick={() => void sincronizar()}>
            {sync.sincronizando ? 'Enviando…' : 'Sincronizar ahora'}
          </button>
        </div>
      </section>
    </>}
  </>
}

function Item({ op }: { op: OperacionLocal }) {
  const final = op.estado === 'CONFIRMADA' || op.estado === 'CONFLICTO' || op.estado === 'RECHAZADA'
  return <li className={styles.item}>
    <div className={styles.itemTop}>
      <strong>{op.resumen}</strong>
      <span className={`${styles.badge} ${BADGE[op.estado]}`}>{ETIQUETA[op.estado]}</span>
    </div>
    <span className={styles.meta}>
      Creada {hora(op.createdAtLocal)} · código {op.operationId.slice(0, 8)}
      {op.serverId ? ` · ${op.type === 'VENTA' ? 'venta' : 'reserva'} #${op.serverId}` : ''}
      {op.intentos > 1 ? ` · ${op.intentos} envíos` : ''}
    </span>
    {op.motivo && <span className={styles.reason}>{op.motivo}</span>}
    {op.alternativas?.length ? <span className={styles.reason}>Disponible en: {[...new Set(op.alternativas.map(a => `${a.sucursal} (${a.stock})`))].join(', ')}</span> : null}
    {op.estado === 'PENDIENTE' && op.ultimoError && <span className={styles.meta}>{op.ultimoError}</span>}
    {final && <button type="button" className={styles.linkBtn} onClick={() => void descartar(op.operationId)}>Quitar de la lista</button>}
  </li>
}
