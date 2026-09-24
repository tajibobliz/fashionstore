import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { catalogApi } from '../../api/catalog.api'
import { inventoryApi } from '../../api/inventory.api'
import { queryKeys } from '../../api/queryKeys'
import { reservationsApi } from '../../api/reservations.api'
import { salesApi } from '../../api/sales.api'
import { warehousesApi } from '../../api/warehouses.api'
import type { Inventario } from '../../types/inventory'
import type { Reserva, ReservaEstado } from '../../types/reservation'
import type { Venta } from '../../types/sale'
import { getApiErrorMessage } from '../../utils/apiError'
import styles from '../dashboard/Dashboard.module.css'

type Section = 'inventario' | 'reservas' | 'ventas'

const money = (value: number | string | undefined) => Number(value ?? 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const productName = (item: Inventario) => item.variante?.producto?.nombre ?? item.variante?.sku ?? 'Variante sin detalle'
const variantName = (item: { sku?: string; talla?: { nombre?: string } | null; color?: { nombre?: string } | null }) => [item.sku, item.talla?.nombre, item.color?.nombre].filter(Boolean).join(' · ') || '—'

export default function BranchOperationsPage({ section }: { section: Section }) {
  if (section === 'inventario') return <InventoryManagement />
  if (section === 'reservas') return <ReservationsManagement />
  return <SalesManagement />
}

function InventoryManagement() {
  const client = useQueryClient()
  const [branchId, setBranchId] = useState(0)
  const [warehouseId, setWarehouseId] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const [createBranchId, setCreateBranchId] = useState(0)
  const [adjusting, setAdjusting] = useState<Inventario | null>(null)
  const [available, setAvailable] = useState(0)
  const [reserved, setReserved] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const inventory = useQuery({ queryKey: queryKeys.inventory.all, queryFn: inventoryApi.list })
  const warehouses = useQuery({ queryKey: queryKeys.warehouses.all, queryFn: warehousesApi.list })
  const variants = useQuery({ queryKey: queryKeys.catalog.variants, queryFn: catalogApi.variants.list })
  const branches = useMemo(() => [...new Map([
    ...(inventory.data ?? []).flatMap(item => item.sucursal ? [[item.sucursal.idSucursal, item.sucursal] as const] : []),
    ...(warehouses.data ?? []).flatMap(item => item.sucursal ? [[item.sucursal.idSucursal, item.sucursal] as const] : []),
  ]).values()], [inventory.data, warehouses.data])
  const filteredWarehouses = (warehouses.data ?? []).filter(item => !branchId || item.sucursal?.idSucursal === branchId)
  const rows = (inventory.data ?? []).filter(item => (!branchId || item.sucursal?.idSucursal === branchId) && (!warehouseId || item.almacen?.idAlmacen === warehouseId))
  const create = useMutation({
    mutationFn: (form: FormData) => inventoryApi.create({ idSucursal: Number(form.get('idSucursal')), idAlmacen: Number(form.get('idAlmacen')), idVariante: Number(form.get('idVariante')), stockDisponible: Number(form.get('stockDisponible') ?? 0), stockReservado: 0 }),
    onSuccess: async () => { setFeedback('Inventario registrado correctamente.'); setError(''); setCreateOpen(false); await client.invalidateQueries({ queryKey: queryKeys.inventory.all }) },
    onError: value => setError(getApiErrorMessage(value)),
  })
  const adjust = useMutation({
    mutationFn: () => inventoryApi.update(adjusting!.idInventario, { stockDisponible: available, stockReservado: reserved }),
    onSuccess: async () => { setFeedback('Stock ajustado correctamente.'); setError(''); setAdjusting(null); await client.invalidateQueries({ queryKey: queryKeys.inventory.all }) },
    onError: value => setError(getApiErrorMessage(value)),
  })
  const loading = inventory.isLoading || warehouses.isLoading || variants.isLoading
  const queryError = inventory.error ?? warehouses.error ?? variants.error
  if (loading) return <div className={styles.chartLoading} role="status">Cargando inventario…</div>
  if (queryError) return <ErrorState error={queryError} retry={() => { void inventory.refetch(); void warehouses.refetch(); void variants.refetch() }} />

  return <section className={styles.content}>
    <PageHeading kicker="Operación territorial" title="Inventario" description="Registra y ajusta existencias únicamente en tus sucursales asignadas." action={<button className="primary-button" onClick={() => { setError(''); setCreateBranchId(branches.length === 1 ? branches[0].idSucursal : 0); setCreateOpen(true) }}>Nuevo inventario</button>} />
    {feedback && <p className={styles.successNotice} role="status">{feedback}</p>}{error && <p className={styles.errorNotice} role="alert">{error}</p>}
    <div className={styles.filtersGrid}><label className={styles.filterField}>Sucursal<select aria-label="Filtrar sucursal" value={branchId} onChange={event => { setBranchId(Number(event.target.value)); setWarehouseId(0) }}><option value={0}>Todas mis sucursales</option>{branches.map(branch => <option key={branch.idSucursal} value={branch.idSucursal}>{branch.nombre}</option>)}</select></label><label className={styles.filterField}>Almacén<select aria-label="Filtrar almacén" value={warehouseId} onChange={event => setWarehouseId(Number(event.target.value))}><option value={0}>Todos los almacenes</option>{filteredWarehouses.map(warehouse => <option key={warehouse.idAlmacen} value={warehouse.idAlmacen}>{warehouse.nombre} ({warehouse.codigo})</option>)}</select></label></div>
    <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Producto</th><th>Variante</th><th>Sucursal</th><th>Almacén</th><th>Disponible</th><th>Reservado</th><th /></tr></thead><tbody>{rows.length ? rows.map(item => <tr key={item.idInventario}><td>{productName(item)}</td><td>{variantName(item.variante ?? {})}</td><td>{item.sucursal?.nombre ?? '—'}</td><td>{item.almacen?.nombre ?? '—'}</td><td>{item.stockDisponible}</td><td>{item.stockReservado}</td><td><button type="button" onClick={() => { setAdjusting(item); setAvailable(item.stockDisponible); setReserved(item.stockReservado) }}>Ajustar</button></td></tr>) : <tr><td colSpan={7}>No hay inventario para los filtros seleccionados.</td></tr>}</tbody></table></div>
    {createOpen && <Modal title="Nuevo inventario" onClose={() => setCreateOpen(false)}><form className={styles.registrationForm} onSubmit={event => { event.preventDefault(); create.mutate(new FormData(event.currentTarget)) }}><label>Sucursal<select name="idSucursal" required value={createBranchId || ''} onChange={event => setCreateBranchId(Number(event.target.value))}><option value="" disabled>Selecciona una sucursal</option>{branches.map(branch => <option key={branch.idSucursal} value={branch.idSucursal}>{branch.nombre}</option>)}</select></label><label>Almacén<select name="idAlmacen" required disabled={!createBranchId} defaultValue=""><option value="" disabled>Selecciona un almacén</option>{(warehouses.data ?? []).filter(warehouse => warehouse.sucursal?.idSucursal === createBranchId).map(warehouse => <option key={warehouse.idAlmacen} value={warehouse.idAlmacen}>{warehouse.nombre} ({warehouse.codigo})</option>)}</select></label><label>Variante<select name="idVariante" required defaultValue=""><option value="" disabled>Selecciona una variante</option>{(variants.data ?? []).map(item => <option key={item.idVariante} value={item.idVariante}>{item.producto?.nombre ?? 'Producto'} · {variantName(item)}</option>)}</select></label><label>Stock disponible<input name="stockDisponible" type="number" min="0" defaultValue={0} required /></label><div className={styles.modalActions}><button type="button" onClick={() => setCreateOpen(false)}>Cancelar</button><button className="primary-button" disabled={create.isPending || !createBranchId}>{create.isPending ? 'Guardando…' : 'Guardar'}</button></div></form></Modal>}
    {adjusting && <Modal title={`Ajustar stock · ${productName(adjusting)}`} onClose={() => setAdjusting(null)}><div className={styles.registrationForm}><label>Disponible<input aria-label="Stock disponible" type="number" min="0" value={available} onChange={event => setAvailable(Math.max(0, Number(event.target.value) || 0))} /></label><label>Reservado<input aria-label="Stock reservado" type="number" min="0" value={reserved} onChange={event => setReserved(Math.max(0, Number(event.target.value) || 0))} /></label><p>El backend registra este cambio como un ajuste de inventario.</p><div className={styles.modalActions}><button type="button" onClick={() => setAdjusting(null)}>Cancelar</button><button className="primary-button" disabled={adjust.isPending} onClick={() => adjust.mutate()}>{adjust.isPending ? 'Guardando…' : 'Guardar ajuste'}</button></div></div></Modal>}
  </section>
}

function ReservationsManagement() {
  const client = useQueryClient()
  const [confirmation, setConfirmation] = useState<{ item: Reserva; action: 'prepare' | 'cancel' } | null>(null)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const reservations = useQuery({ queryKey: queryKeys.reservations.all, queryFn: reservationsApi.list })
  const change = useMutation({
    mutationFn: () => confirmation!.action === 'prepare' ? reservationsApi.updateStatus(confirmation!.item.idReserva, 'PREPARADA' as ReservaEstado) : reservationsApi.cancel(confirmation!.item.idReserva),
    onSuccess: async () => { setFeedback(confirmation?.action === 'prepare' ? 'Reserva marcada como PREPARADA.' : 'Reserva cancelada y stock liberado.'); setError(''); setConfirmation(null); await client.invalidateQueries({ queryKey: queryKeys.reservations.all }); await client.invalidateQueries({ queryKey: queryKeys.inventory.all }) },
    onError: value => setError(getApiErrorMessage(value)),
  })
  if (reservations.isLoading) return <div className={styles.chartLoading} role="status">Cargando reservas…</div>
  if (reservations.error) return <ErrorState error={reservations.error} retry={() => void reservations.refetch()} />
  const rows = reservations.data ?? []
  return <section className={styles.content}>
    <PageHeading kicker="Operación territorial" title="Reservas" description="Gestiona solo las reservas recibidas por tus sucursales asignadas." />
    {feedback && <p className={styles.successNotice} role="status">{feedback}</p>}{error && <p className={styles.errorNotice} role="alert">{error}</p>}
    <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Reserva</th><th>Cliente</th><th>Sucursal</th><th>Detalle</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{rows.length ? rows.map(item => <tr key={item.idReserva}><td>{item.codigo ?? `#${item.idReserva}`}</td><td>{item.usuario ? `${item.usuario.nombre ?? ''} ${item.usuario.apellido ?? ''}`.trim() || item.usuario.email || '—' : '—'}</td><td>{item.sucursal?.nombre ?? '—'}</td><td>{item.detalles?.map(detail => `${detail.variante?.producto?.nombre ?? detail.variante?.sku ?? 'Variante'} × ${detail.cantidad}`).join(', ') || '—'}</td><td>{item.fechaReserva ? new Date(item.fechaReserva).toLocaleString('es-BO') : '—'}</td><td>{item.estado}</td><td><div className={styles.rowActions}>{item.estado === 'PENDIENTE' && <button type="button" onClick={() => setConfirmation({ item, action: 'prepare' })}>Preparar</button>}{['PENDIENTE', 'PREPARADA'].includes(item.estado) && <button type="button" className={styles.dangerButton} onClick={() => setConfirmation({ item, action: 'cancel' })}>Cancelar</button>}</div></td></tr>) : <tr><td colSpan={7}>No hay reservas en tus sucursales.</td></tr>}</tbody></table></div>
    {confirmation && <Modal title={confirmation.action === 'prepare' ? 'Preparar reserva' : 'Cancelar reserva'} onClose={() => setConfirmation(null)}><p>{confirmation.action === 'prepare' ? 'La reserva quedará lista para ser atendida en punto de venta.' : 'Se liberará el stock reservado. Esta acción no se puede deshacer.'}</p><div className={styles.modalActions}><button type="button" onClick={() => setConfirmation(null)}>Volver</button><button className={confirmation.action === 'cancel' ? styles.dangerButton : 'primary-button'} disabled={change.isPending} onClick={() => change.mutate()}>{change.isPending ? 'Procesando…' : 'Confirmar'}</button></div></Modal>}
  </section>
}

function SalesManagement() {
  const [filter, setFilter] = useState('')
  const sales = useQuery({ queryKey: queryKeys.sales.all, queryFn: salesApi.list })
  if (sales.isLoading) return <div className={styles.chartLoading} role="status">Cargando ventas…</div>
  if (sales.error) return <ErrorState error={sales.error} retry={() => void sales.refetch()} />
  const normalized = filter.trim().toLocaleLowerCase()
  const rows = (sales.data ?? []).filter(item => `${item.numeroComprobante ?? ''} ${item.usuario?.nombre ?? ''} ${item.usuario?.apellido ?? ''} ${item.usuario?.email ?? ''} ${item.sucursal?.nombre ?? ''}`.toLocaleLowerCase().includes(normalized))
  return <section className={styles.content}>
    <PageHeading kicker="Operación territorial" title="Ventas" description="Consulta las ventas realizadas en tus sucursales asignadas." />
    <label className={styles.searchField}>Buscar venta o cliente<input aria-label="Buscar ventas" value={filter} onChange={event => setFilter(event.target.value)} placeholder="Comprobante, cliente o sucursal" /></label>
    <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Comprobante</th><th>Fecha</th><th>Cliente</th><th>Sucursal</th><th>Canal</th><th>Total</th><th>Estado</th></tr></thead><tbody>{rows.length ? rows.map(item => <SaleRow key={item.idVenta} sale={item} />) : <tr><td colSpan={7}>{filter ? 'No se encontraron ventas.' : 'No hay ventas en tus sucursales.'}</td></tr>}</tbody></table></div>
  </section>
}

function SaleRow({ sale }: { sale: Venta }) {
  const detail = sale.detalles?.map(item => `${item.variante?.producto?.nombre ?? item.variante?.sku ?? 'Variante'} × ${item.cantidad}`).join(', ')
  return <tr><td><strong>{sale.numeroComprobante ?? `#${sale.idVenta}`}</strong>{detail && <details><summary>Ver detalle</summary><p>{detail}</p></details>}</td><td>{sale.fecha ? new Date(sale.fecha).toLocaleString('es-BO') : '—'}</td><td>{sale.usuario ? `${sale.usuario.nombre} ${sale.usuario.apellido ?? ''}`.trim() : 'Venta sin cliente'}</td><td>{sale.sucursal?.nombre ?? '—'}</td><td>{sale.tipoVenta}</td><td>Bs {money(sale.total)}</td><td>{sale.estado ?? '—'}</td></tr>
}

function PageHeading({ kicker, title, description, action }: { kicker: string; title: string; description: string; action?: ReactNode }) {
  return <div className={styles.pageHeading}><div><p className={styles.kicker}>{kicker}</p><h1>{title}</h1><p>{description}</p></div>{action}</div>
}
function ErrorState({ error, retry }: { error: unknown; retry: () => void }) { return <section className={styles.panel}><p className={styles.errorNotice} role="alert">{getApiErrorMessage(error)}</p><button className="primary-button" onClick={retry}>Reintentar</button></section> }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) { return <div className={styles.modalBackdrop} role="presentation"><section className={styles.formModal} role="dialog" aria-modal="true" aria-labelledby="branch-operation-title"><div className={styles.modalHeader}><h2 id="branch-operation-title">{title}</h2><button type="button" aria-label="Cerrar" onClick={onClose}>×</button></div>{children}</section></div> }
