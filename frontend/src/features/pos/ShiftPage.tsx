import { useState } from 'react'
import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { branchesApi } from '../../api/branches.api'
import { posApi } from '../../api/pos.api'
import { queryKeys } from '../../api/queryKeys'
import type { Caja } from '../../types/pos'
import { getApiErrorMessage } from '../../utils/apiError'
import dashboardStyles from '../dashboard/Dashboard.module.css'
import styles from './ShiftPage.module.css'

function isMissingShift(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 404
}

async function allowedBoxes() {
  const branches = await branchesApi.branches.list()
  const results = await Promise.allSettled(branches.filter(branch => branch.estado).map(branch => posApi.boxes.byBranch(branch.idSucursal)))
  const unique = new Map<number, Caja>()
  for (const result of results) {
    if (result.status === 'fulfilled') {
      for (const box of result.value) if (box.estado) unique.set(box.idCaja, box)
    }
  }
  return [...unique.values()]
}

function money(value: number | string | null | undefined) {
  return Number(value ?? 0).toFixed(2)
}

export default function ShiftPage() {
  const queryClient = useQueryClient()
  const [idCaja, setIdCaja] = useState(0)
  const [montoApertura, setMontoApertura] = useState('')
  const [montoCierre, setMontoCierre] = useState('')
  const [confirmClose, setConfirmClose] = useState(false)
  const [feedback, setFeedback] = useState('')

  const current = useQuery({
    queryKey: queryKeys.shifts.current,
    queryFn: posApi.shifts.current,
    retry: false,
  })
  const activeShift = current.data?.estado === 'ABIERTO' ? current.data : undefined
  const hasOpenShift = Boolean(activeShift)
  const boxes = useQuery({
    queryKey: queryKeys.boxes.allowed,
    queryFn: allowedBoxes,
    enabled: !current.isLoading && !hasOpenShift,
    retry: false,
  })

  const open = useMutation({
    mutationFn: () => posApi.shifts.open({ idCaja, montoApertura: Number(montoApertura) }),
    onSuccess: async () => {
      setFeedback('Turno abierto correctamente.')
      setMontoApertura('')
      await queryClient.invalidateQueries({ queryKey: queryKeys.shifts.current })
    },
  })
  const close = useMutation({
    mutationFn: () => posApi.shifts.close(activeShift!.idTurno, { montoCierreDeclarado: Number(montoCierre) }),
    onSuccess: async result => {
      setFeedback(`Turno cerrado. Diferencia: Bs ${money(result.diferencia)}.`)
      setConfirmClose(false)
      setMontoCierre('')
      queryClient.setQueryData(queryKeys.shifts.current, null)
      await queryClient.invalidateQueries({ queryKey: queryKeys.shifts.current })
    },
  })

  if (current.isLoading) return <div className={dashboardStyles.chartLoading} role="status">Consultando turno actual…</div>
  const currentError = current.error && !isMissingShift(current.error) ? getApiErrorMessage(current.error) : ''
  const operationError = open.error || close.error

  return <div className={dashboardStyles.content}>
    <div className={dashboardStyles.pageHeading}><div><p className={dashboardStyles.kicker}>Operación de caja</p><h1>Mi turno</h1><p>Abre tu turno antes de ingresar al punto de venta.</p></div></div>
    {feedback && <p className={styles.success} role="status">{feedback}</p>}
    {(currentError || operationError) && <p className={styles.error} role="alert">{currentError || getApiErrorMessage(operationError)}</p>}

    {hasOpenShift ? <section className={dashboardStyles.panel}>
      <div className={dashboardStyles.panelHeader}><div><h2>Turno abierto</h2><p>Tu caja está lista para atender ventas.</p></div><span className={styles.openBadge}>ABIERTO</span></div>
      <dl className={styles.details}>
        <div><dt>Caja</dt><dd>{activeShift!.caja.nombre}</dd></div>
        <div><dt>Sucursal</dt><dd>{activeShift!.caja.sucursal?.nombre ?? '—'}</dd></div>
        <div><dt>Cajero</dt><dd>{[activeShift!.cajero?.nombre, activeShift!.cajero?.apellido].filter(Boolean).join(' ') || '—'}</dd></div>
        <div><dt>Apertura</dt><dd>{new Date(activeShift!.fechaApertura).toLocaleString()}</dd></div>
        <div><dt>Monto de apertura</dt><dd>Bs {money(activeShift!.montoApertura)}</dd></div>
        <div><dt>Estado</dt><dd>{activeShift!.estado}</dd></div>
      </dl>
      <div className={styles.actions}><Link className={styles.primary} to="/dashboard/cajero/punto-de-venta">Ir al punto de venta</Link><button className={styles.secondary} type="button" onClick={() => setConfirmClose(true)}>Cerrar turno</button></div>
      {confirmClose && <form className={styles.closeForm} onSubmit={event => { event.preventDefault(); close.mutate() }}>
        <label>Monto de cierre declarado<input aria-label="Monto de cierre declarado" type="number" min="0" step="0.01" required value={montoCierre} onChange={event => setMontoCierre(event.target.value)} /></label>
        <p>Confirma el efectivo contado. El backend calculará el monto esperado y la diferencia.</p>
        <div className={styles.actions}><button className={styles.danger} disabled={close.isPending} type="submit">{close.isPending ? 'Cerrando…' : 'Confirmar cierre'}</button><button className={styles.secondary} type="button" onClick={() => setConfirmClose(false)}>Cancelar</button></div>
      </form>}
    </section> : <section className={dashboardStyles.panel}>
      <div className={dashboardStyles.panelHeader}><div><h2>Abrir turno</h2><p>Selecciona una caja de tus sucursales asignadas.</p></div></div>
      {boxes.isLoading ? <div className={dashboardStyles.chartLoading} role="status">Consultando cajas permitidas…</div> : boxes.error ? <p className={styles.error} role="alert">{getApiErrorMessage(boxes.error)}</p> : <form className={styles.form} onSubmit={event => { event.preventDefault(); open.mutate() }}>
        <label>Caja<select aria-label="Caja" required value={idCaja || ''} onChange={event => setIdCaja(Number(event.target.value))}><option value="">Selecciona una caja</option>{(boxes.data ?? []).map(box => <option value={box.idCaja} key={box.idCaja}>{box.nombre} · {box.sucursal?.nombre ?? box.codigo}</option>)}</select></label>
        <label>Monto de apertura<input aria-label="Monto de apertura" type="number" min="0" step="0.01" required value={montoApertura} onChange={event => setMontoApertura(event.target.value)} /></label>
        {boxes.data?.length === 0 && <p className={styles.empty}>No tienes cajas activas disponibles en tus sucursales asignadas.</p>}
        <button className={styles.primary} type="submit" disabled={!idCaja || montoApertura === '' || open.isPending}>{open.isPending ? 'Abriendo…' : 'Abrir turno'}</button>
      </form>}
    </section>}
  </div>
}
