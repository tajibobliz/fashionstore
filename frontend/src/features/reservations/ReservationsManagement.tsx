import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { reservationsApi } from '../../api/reservations.api'
import { queryKeys } from '../../api/queryKeys'
import type { Reserva, ReservaEstado } from '../../types/reservation'
import { getApiErrorMessage } from '../../utils/apiError'
import dashboardStyles from '../dashboard/Dashboard.module.css'
import styles from './ReservationsManagement.module.css'

const ESTADOS: ReservaEstado[] = ['PENDIENTE', 'PREPARADA', 'ATENDIDA', 'CANCELADA']
const ESTADO_LABEL: Record<ReservaEstado, string> = { PENDIENTE: 'Pendiente', PREPARADA: 'Preparada', ATENDIDA: 'Atendida', CANCELADA: 'Cancelada' }

function fecha(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' })
}

function productos(reserva: Reserva) {
  const detalles = reserva.detalles ?? []
  if (!detalles.length) return '—'
  return detalles.map(item => `${item.variante?.producto?.nombre ?? 'Producto'} (${item.variante?.sku ?? '—'}) ×${item.cantidad}`).join(', ')
}

export default function ReservationsManagement() {
  const client = useQueryClient()
  const [filtro, setFiltro] = useState<ReservaEstado | ''>('')
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')

  const reservations = useQuery({ queryKey: queryKeys.reservations.all, queryFn: reservationsApi.list })

  const setEstado = useMutation({
    mutationFn: ({ id, estado }: { id: number; estado: ReservaEstado }) => reservationsApi.updateStatus(id, estado),
    onSuccess: async () => { setFeedback('Reserva actualizada correctamente.'); setError(''); await client.invalidateQueries({ queryKey: queryKeys.reservations.all }) },
    onError: value => { setError(getApiErrorMessage(value)); setFeedback('') },
  })
  const cancel = useMutation({
    mutationFn: (id: number) => reservationsApi.cancel(id),
    onSuccess: async () => { setFeedback('Reserva cancelada correctamente.'); setError(''); await client.invalidateQueries({ queryKey: queryKeys.reservations.all }) },
    onError: value => { setError(getApiErrorMessage(value)); setFeedback('') },
  })

  const rows = useMemo(() => {
    const list = [...(reservations.data ?? [])].sort((a, b) => new Date(b.fechaReserva ?? 0).getTime() - new Date(a.fechaReserva ?? 0).getTime())
    return filtro ? list.filter(item => item.estado === filtro) : list
  }, [reservations.data, filtro])

  const pendingId = setEstado.isPending ? setEstado.variables?.id : cancel.isPending ? cancel.variables : null

  return <section className={dashboardStyles.content}>
    <div className={dashboardStyles.pageHeading}><div><p className={dashboardStyles.kicker}>Operación de tienda</p><h1>Reservas</h1><p>Marca las reservas como preparadas cuando el producto esté listo, o cancélalas si corresponde.</p></div></div>
    {feedback && <p className={dashboardStyles.successNotice} role="status">{feedback}</p>}
    {error && <p className={dashboardStyles.errorNotice} role="alert">{error}</p>}
    <label className={dashboardStyles.searchField}>Filtrar por estado
      <select aria-label="Filtrar reservas por estado" value={filtro} onChange={event => setFiltro(event.target.value as ReservaEstado | '')}>
        <option value="">Todas</option>
        {ESTADOS.map(estado => <option key={estado} value={estado}>{ESTADO_LABEL[estado]}</option>)}
      </select>
    </label>
    {reservations.isLoading ? <div className={dashboardStyles.chartLoading} role="status">Cargando reservas…</div>
      : reservations.error ? <p className={dashboardStyles.errorNotice} role="alert">{getApiErrorMessage(reservations.error)}</p>
      : <div className={dashboardStyles.panel}>
        <div className={dashboardStyles.panelHeader}><h2>Reservas</h2><span className={dashboardStyles.panelCount}>{rows.length} registros</span></div>
        {rows.length ? <div className={dashboardStyles.tableWrap}><table className={dashboardStyles.table}>
          <thead><tr><th>ID</th><th>Cliente</th><th>Producto</th><th>Sucursal</th><th>Estado</th><th>Fecha creación</th><th>Fecha atención</th><th>Acciones</th></tr></thead>
          <tbody>{rows.map(reserva => {
            const busy = pendingId === reserva.idReserva
            return <tr key={reserva.idReserva}>
              <td>{reserva.codigo ?? reserva.idReserva}</td>
              <td>{reserva.usuario ? <>{reserva.usuario.nombre} {reserva.usuario.apellido ?? ''}<br /><small>{reserva.usuario.email ?? '—'}</small></> : '—'}</td>
              <td>{productos(reserva)}</td>
              <td>{reserva.sucursal?.nombre ?? '—'}</td>
              <td><span className={`${styles.badge} ${styles[`badge_${reserva.estado}`]}`}>{ESTADO_LABEL[reserva.estado]}</span></td>
              <td>{fecha(reserva.fechaReserva)}</td>
              <td>{fecha(reserva.fechaAtencion)}</td>
              <td><div className={dashboardStyles.rowActions}>
                {reserva.estado === 'PENDIENTE' && <button type="button" disabled={busy} onClick={() => setEstado.mutate({ id: reserva.idReserva, estado: 'PREPARADA' })}>{busy ? 'Guardando…' : 'Marcar como preparada'}</button>}
                {(reserva.estado === 'PENDIENTE' || reserva.estado === 'PREPARADA') && <button type="button" className={dashboardStyles.dangerButton} disabled={busy} onClick={() => { if (window.confirm('¿Confirmas cancelar esta reserva? Se liberará el stock reservado.')) cancel.mutate(reserva.idReserva) }}>{busy ? 'Cancelando…' : 'Cancelar'}</button>}
                {(reserva.estado === 'ATENDIDA' || reserva.estado === 'CANCELADA') && '—'}
              </div></td>
            </tr>
          })}</tbody>
        </table></div> : <p className={dashboardStyles.emptyState}>{filtro ? 'No hay reservas con ese estado.' : 'Todavía no hay reservas registradas.'}</p>}
      </div>}
  </section>
}
