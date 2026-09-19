import { useMemo, useState } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { catalogApi } from '../../api/catalog.api'
import { inventoryApi } from '../../api/inventory.api'
import { posApi } from '../../api/pos.api'
import { salesApi } from '../../api/sales.api'
import { paymentsApi } from '../../api/payments.api'
import { usersApi } from '../../api/users.api'
import { queryKeys } from '../../api/queryKeys'
import type { Inventario } from '../../types/inventory'
import type { Producto, Variante } from '../../types/catalog'
import type { Venta } from '../../types/sale'
import type { MetodoPago, Pago } from '../../types/payment'
import type { User } from '../../types/user'
import { getApiErrorMessage } from '../../utils/apiError'
import dashboardStyles from '../dashboard/Dashboard.module.css'
import styles from './PosPage.module.css'

type Mode = 'MINORISTA' | 'MAYORISTA'
interface AvailableVariant { inventory: Inventario; variant: Variante; product: Producto }
interface CartLine extends AvailableVariant { quantity: number }
interface Receipt { sale: Venta; payment: Pago; received: number | null; lines: CartLine[] }

export default function PosPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<Mode>('MINORISTA')
  const [cart, setCart] = useState<CartLine[]>([])
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [cashReceived, setCashReceived] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<MetodoPago>('EFECTIVO')
  const [paymentReference, setPaymentReference] = useState('')
  const [customerQuery, setCustomerQuery] = useState('')
  const [customer, setCustomer] = useState<User | null>(null)
  const [newCustomer, setNewCustomer] = useState(false)
  const [customerForm, setCustomerForm] = useState({ nombre: '', email: '', password: '' })
  const [requestIds, setRequestIds] = useState<{ sale: string; payment: string } | null>(null)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const clients = useQuery({ queryKey: ['clients', customerQuery], queryFn: () => usersApi.clients(customerQuery), enabled: checkoutOpen && !newCustomer && customerQuery.trim().length >= 2, retry: false })
  const createCustomer = useMutation({ mutationFn: () => usersApi.create({ ...customerForm, rolNombre: 'CLIENTE' }), onSuccess: created => { setCustomer(created as User); setNewCustomer(false) } })
  const shift = useQuery({
    queryKey: queryKeys.shifts.current,
    queryFn: async () => {
      try { return await posApi.shifts.current() }
      catch (error) { if (axios.isAxiosError(error) && error.response?.status === 404) return null; throw error }
    },
    retry: false,
  })
  const inventory = useQuery({ queryKey: queryKeys.inventory.all, queryFn: inventoryApi.list, enabled: shift.data?.estado === 'ABIERTO' })
  const variants = useQuery({ queryKey: queryKeys.catalog.variants, queryFn: catalogApi.variants.list, enabled: shift.data?.estado === 'ABIERTO' })
  const warehouse = useMemo(() => {
    if (!shift.data) return undefined
    if (shift.data.caja.almacenDefault) return shift.data.caja.almacenDefault
    const branchId = shift.data.caja.sucursal?.idSucursal
    return inventory.data?.find(item => item.sucursal?.idSucursal === branchId && item.almacen?.codigo === 'PRINCIPAL')?.almacen
  }, [inventory.data, shift.data])
  const available = useMemo(() => {
    if (!warehouse) return []
    const variantsById = new Map((variants.data ?? []).map(variant => [variant.idVariante, variant]))
    return (inventory.data ?? []).flatMap(item => {
      if (item.almacen?.idAlmacen !== warehouse.idAlmacen) return []
      const variant = variantsById.get(item.variante?.idVariante ?? item.idVariante ?? 0) ?? item.variante
      if (!variant?.producto || variant.estado === false || variant.producto.estado === false) return []
      return [{ inventory: item, variant, product: variant.producto }]
    })
  }, [inventory.data, variants.data, warehouse])
  const results = available.filter(item => `${item.product.nombre} ${item.variant.sku}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))

  function price(product: Producto) {
    return Number(mode === 'MAYORISTA' ? product.precioMayorista : product.precio)
  }
  function wholesaleAvailable(product: Producto) {
    return product.precioMayorista !== undefined && product.precioMayorista !== null && !!product.cantidadMinimaMayorista
  }
  function add(item: AvailableVariant) {
    if (item.inventory.stockDisponible <= 0 || (mode === 'MAYORISTA' && !wholesaleAvailable(item.product))) return
    setCart(current => {
      const existing = current.find(line => line.variant.idVariante === item.variant.idVariante)
      if (existing) return current.map(line => line.variant.idVariante === item.variant.idVariante && line.quantity < line.inventory.stockDisponible ? { ...line, quantity: line.quantity + 1 } : line)
      const minimum = mode === 'MAYORISTA' ? item.product.cantidadMinimaMayorista ?? 1 : 1
      return minimum <= item.inventory.stockDisponible ? [...current, { ...item, quantity: minimum }] : current
    })
  }
  function changeQuantity(id: number, delta: number) {
    setCart(current => current.map(line => line.variant.idVariante === id ? { ...line, quantity: Math.max(1, Math.min(line.inventory.stockDisponible, line.quantity + delta)) } : line))
  }
  const estimatedTotal = cart.reduce((total, line) => total + (Number.isFinite(price(line.product)) ? price(line.product) * line.quantity : 0), 0)
  const invalidWholesale = mode === 'MAYORISTA' && cart.some(line => !wholesaleAvailable(line.product) || line.quantity < (line.product.cantidadMinimaMayorista ?? 1))
  const checkout = useMutation({
    mutationFn: async () => {
      if (!shift.data?.caja.sucursal || !requestIds) throw new Error('No se pudo determinar el turno de la venta.')
      const sale = await salesApi.presencial({
        idSucursal: shift.data.caja.sucursal.idSucursal,
        idCaja: shift.data.caja.idCaja,
        modalidadComercial: mode,
        ...(customer ? { idUsuario: customer.idUsuario } : {}),
        detalles: cart.map(line => ({ idVariante: line.variant.idVariante, cantidad: line.quantity })),
        clientRequestId: requestIds.sale,
      })
      const realTotal = Number(sale.total)
      if (paymentMethod === 'EFECTIVO' && Number(cashReceived) < realTotal) throw new Error(`El monto recibido debe cubrir el total real de Bs ${money(realTotal)}.`)
      const payment = await paymentsApi.create({
        idVenta: sale.idVenta,
        metodo: paymentMethod,
        monto: realTotal,
        clientRequestId: requestIds.payment,
        ...(paymentReference.trim() ? { referenciaPasarela: paymentReference.trim() } : {}),
      })
      return { sale, payment, received: paymentMethod === 'EFECTIVO' ? Number(cashReceived) : null, lines: [...cart] }
    },
    onSuccess: result => {
      setReceipt(result)
      setCart([])
      setCheckoutOpen(false)
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.shifts.current }),
      ])
    },
  })

  function openCheckout() {
    setCashReceived(money(estimatedTotal))
    setPaymentMethod('EFECTIVO')
    setPaymentReference('')
    setRequestIds({ sale: crypto.randomUUID(), payment: crypto.randomUUID() })
    checkout.reset()
    setCheckoutOpen(true)
  }

  function newSale() {
    setReceipt(null)
    setRequestIds(null)
    setCashReceived('')
    setPaymentMethod('EFECTIVO')
    setPaymentReference('')
    setMode('MINORISTA')
    setSearch('')
  }

  if (shift.isLoading) return <div className={dashboardStyles.chartLoading} role="status">Consultando turno actual…</div>
  if (shift.error) return <p className={dashboardStyles.errorNotice} role="alert">{getApiErrorMessage(shift.error)}</p>
  if (!shift.data || shift.data.estado !== 'ABIERTO') return <section className={dashboardStyles.content}><div className={dashboardStyles.pageHeading}><div><p className={dashboardStyles.kicker}>Punto de venta</p><h1>Turno cerrado</h1></div></div><div className={styles.closed}><p>Necesitas un turno abierto para acceder al punto de venta.</p><Link className={dashboardStyles.textLink} to="/dashboard/cajero/caja">Ir a Mi caja</Link></div></section>
  if (inventory.isLoading || variants.isLoading) return <div className={dashboardStyles.chartLoading} role="status">Cargando catálogo e inventario…</div>
  if (inventory.error || variants.error) return <p className={dashboardStyles.errorNotice} role="alert">{getApiErrorMessage(inventory.error ?? variants.error)}</p>
  if (!warehouse) return <p className={dashboardStyles.errorNotice} role="alert">No se pudo determinar el almacén de esta caja.</p>
  if (receipt) return <ReceiptView receipt={receipt} fallbackShift={shift.data} onNewSale={newSale} />

  return <section className={dashboardStyles.content}>
    <div className={dashboardStyles.pageHeading}><div><p className={dashboardStyles.kicker}>Punto de venta</p><h1>Nueva atención</h1><p>Prepara la lista local antes de continuar al cobro.</p></div></div>
    <div className={styles.contextGrid}><Context label="Sucursal" value={shift.data.caja.sucursal?.nombre ?? '—'} /><Context label="Caja" value={shift.data.caja.nombre} /><Context label="Turno" value={`#${shift.data.idTurno}`} /><Context label="Cajero" value={[shift.data.cajero?.nombre, shift.data.cajero?.apellido].filter(Boolean).join(' ') || '—'} /><Context label="Almacén" value={warehouse.nombre} /></div>
    <div className={styles.workspace}>
      <section className={styles.catalogPanel}><div className={styles.toolbar}><label className={styles.search}>Buscar por producto o SKU<input aria-label="Buscar producto o SKU" value={search} onChange={event => setSearch(event.target.value)} placeholder="Ej. vestido o SKU-001" /></label><label className={styles.mode}>Modalidad<select aria-label="Modalidad comercial" value={mode} onChange={event => setMode(event.target.value as Mode)}><option value="MINORISTA">MINORISTA</option><option value="MAYORISTA">MAYORISTA</option></select></label></div><div className={styles.results}>{results.length ? results.map(item => {
        const wholesale = wholesaleAvailable(item.product)
        const noWholesaleStock = mode === 'MAYORISTA' && wholesale && item.inventory.stockDisponible < (item.product.cantidadMinimaMayorista ?? 1)
        const disabled = item.inventory.stockDisponible === 0 || (mode === 'MAYORISTA' && (!wholesale || noWholesaleStock))
        return <article className={styles.product} key={item.variant.idVariante}><div><h3>{item.product.nombre}</h3><p>{item.variant.sku} · Talla: {item.variant.talla?.nombre ?? 'Única'} · Color: {item.variant.color?.nombre ?? '—'}</p><p>Stock disponible: <strong>{item.inventory.stockDisponible}</strong></p>{mode === 'MINORISTA' ? <p>Precio: Bs {money(item.product.precio)}</p> : wholesale ? <p>Precio mayorista: Bs {money(item.product.precioMayorista)} · Mínimo: {item.product.cantidadMinimaMayorista}</p> : <p className={styles.unavailable}>No disponible para venta mayorista.</p>}{noWholesaleStock && <p className={styles.unavailable}>Stock menor al mínimo mayorista.</p>}</div><button type="button" disabled={disabled} onClick={() => add(item)}>{item.inventory.stockDisponible ? 'Agregar' : 'Sin stock'}</button></article>
      }) : <p className={dashboardStyles.emptyState}>{search ? 'No se encontraron productos para la búsqueda.' : 'No hay variantes disponibles en este almacén.'}</p>}</div></section>
      <aside className={styles.summary}><h2>Resumen de venta</h2>{cart.length ? <div className={styles.cartList}>{cart.map(line => { const minimum = line.product.cantidadMinimaMayorista ?? 1; const lineInvalid = mode === 'MAYORISTA' && (!wholesaleAvailable(line.product) || line.quantity < minimum); return <article className={styles.cartItem} key={line.variant.idVariante}><div className={styles.cartItemHeader}><strong>{line.product.nombre}</strong><span>Bs {money(price(line.product) * line.quantity)}</span></div><p>{line.variant.sku} · {line.quantity} × Bs {money(price(line.product))}</p><div className={styles.quantity}><button type="button" aria-label={`Disminuir ${line.product.nombre}`} onClick={() => changeQuantity(line.variant.idVariante, -1)} disabled={line.quantity <= 1}>−</button><span aria-label={`Cantidad de ${line.product.nombre}`}>{line.quantity}</span><button type="button" aria-label={`Aumentar ${line.product.nombre}`} onClick={() => changeQuantity(line.variant.idVariante, 1)} disabled={line.quantity >= line.inventory.stockDisponible}>+</button><button type="button" className={styles.remove} onClick={() => setCart(current => current.filter(item => item.variant.idVariante !== line.variant.idVariante))}>Eliminar</button></div>{lineInvalid && <p className={styles.warning}>{wholesaleAvailable(line.product) ? `Mínimo mayorista: ${minimum}` : 'Producto sin precio mayorista.'}</p>}</article>})}</div> : <p className={dashboardStyles.emptyState}>Todavía no agregaste productos.</p>}<div className={styles.total}><strong>Total estimado</strong><strong>Bs {money(estimatedTotal)}</strong></div><button className={styles.checkout} type="button" disabled={!cart.length || invalidWholesale} onClick={openCheckout}>Continuar al cobro</button><p className={dashboardStyles.emptyState}>El backend confirmará el precio y total definitivos.</p></aside>
    </div>
    {checkoutOpen && <div className={styles.checkoutBackdrop} role="presentation"><section className={styles.checkoutDialog} role="dialog" aria-modal="true" aria-labelledby="checkout-title"><h2 id="checkout-title">Cobro</h2><p>Modalidad: <strong>{mode}</strong></p><div className={styles.checkoutLines}>{cart.map(line => <div key={line.variant.idVariante}><span>{line.product.nombre} · {line.variant.sku} · {line.quantity} unidades</span><strong>Bs {money(price(line.product) * line.quantity)}</strong></div>)}</div><div className={styles.total}><strong>Total estimado</strong><strong>Bs {money(estimatedTotal)}</strong></div><div className={styles.cashField}><strong>Cliente (opcional)</strong>{customer ? <p>{customer.nombre} <button type="button" onClick={() => setCustomer(null)}>Quitar</button></p> : newCustomer ? <div><input aria-label="Nombre cliente" placeholder="Nombre" value={customerForm.nombre} onChange={e => setCustomerForm({ ...customerForm, nombre: e.target.value })} /><input aria-label="Email cliente" placeholder="Correo" value={customerForm.email} onChange={e => setCustomerForm({ ...customerForm, email: e.target.value })} /><input aria-label="Contraseña cliente" type="password" placeholder="Contraseña inicial" value={customerForm.password} onChange={e => setCustomerForm({ ...customerForm, password: e.target.value })} /><button type="button" disabled={!customerForm.nombre || !customerForm.email || customerForm.password.length < 6 || createCustomer.isPending} onClick={() => createCustomer.mutate()}>{createCustomer.isPending ? 'Guardando…' : 'Guardar cliente'}</button></div> : <div><input aria-label="Buscar cliente" placeholder="Nombre o correo" value={customerQuery} onChange={e => setCustomerQuery(e.target.value)} />{(clients.data ?? []).map(client => <button type="button" key={client.idUsuario} onClick={() => setCustomer(client)}>{client.nombre} · {client.email}</button>)}<button type="button" onClick={() => setNewCustomer(true)}>Nuevo cliente</button></div>}</div><label className={styles.cashField}>Método de pago<select aria-label="Método de pago" value={paymentMethod} onChange={event => { setPaymentMethod(event.target.value as MetodoPago); checkout.reset() }}><option value="EFECTIVO">EFECTIVO</option><option value="QR">QR</option><option value="TARJETA">TARJETA</option><option value="TRANSFERENCIA">TRANSFERENCIA</option><option value="CONTRAPAGO">CONTRAPAGO</option></select></label>{paymentMethod === 'EFECTIVO' ? <><label className={styles.cashField}>Monto recibido<input aria-label="Monto recibido" type="number" min="0" step="0.01" value={cashReceived} onChange={event => setCashReceived(event.target.value)} /></label><p>Cambio estimado: <strong>Bs {money(Math.max(0, Number(cashReceived || 0) - estimatedTotal))}</strong></p></> : <><p className={styles.pendingHint}>Se registrará el pago como {paymentMethod}. No se simula ninguna pasarela externa.</p>{paymentMethod !== 'CONTRAPAGO' && <label className={styles.cashField}>Referencia o comprobante (opcional)<input aria-label="Referencia o comprobante" maxLength={150} value={paymentReference} onChange={event => setPaymentReference(event.target.value)} /></label>}</>}{checkout.error && <p className={dashboardStyles.errorNotice} role="alert">{checkout.error instanceof Error && !axios.isAxiosError(checkout.error) ? checkout.error.message : getApiErrorMessage(checkout.error)}</p>}<div className={styles.checkoutActions}><button type="button" onClick={() => setCheckoutOpen(false)} disabled={checkout.isPending}>Volver</button><button className={styles.checkout} type="button" disabled={checkout.isPending || (paymentMethod === 'EFECTIVO' && Number(cashReceived) < estimatedTotal)} onClick={() => checkout.mutate()}>{checkout.isPending ? 'Procesando…' : 'Completar venta'}</button></div></section></div>}
  </section>
}

function Context({ label, value }: { label: string; value: string }) { return <div className={styles.contextItem}><span>{label}</span><strong>{value}</strong></div> }
function money(value: number | string | null | undefined) { const number = Number(value); return value !== null && value !== undefined && Number.isFinite(number) ? number.toFixed(2) : '—' }

function ReceiptView({ receipt, fallbackShift, onNewSale }: { receipt: Receipt; fallbackShift: NonNullable<Awaited<ReturnType<typeof posApi.shifts.current>>>; onNewSale: () => void }) {
  const { sale, payment, received, lines } = receipt
  const total = Number(sale.total)
  const isPending = payment.estado === 'PENDIENTE'
  const details = sale.detalles?.length ? sale.detalles.map(detail => ({ key: detail.idDetalleVenta ?? detail.variante?.idVariante, name: detail.variante?.producto?.nombre ?? detail.variante?.sku ?? 'Producto', sku: detail.variante?.sku ?? '', quantity: detail.cantidad, subtotal: detail.subtotal })) : lines.map(line => ({ key: line.variant.idVariante, name: line.product.nombre, sku: line.variant.sku, quantity: line.quantity, subtotal: priceForReceipt(line, sale.modalidadComercial) * line.quantity }))
  return <section className={dashboardStyles.content}><div className={dashboardStyles.pageHeading}><div><p className={dashboardStyles.kicker}>{isPending ? 'Pago pendiente' : 'Venta completada'}</p><h1>Comprobante</h1><p>{isPending ? 'El pago fue registrado y permanece pendiente de aprobación.' : 'El pago fue registrado correctamente.'}</p></div></div><article className={styles.receipt}><div className={styles.receiptHeader}><div><span>Número de comprobante</span><strong>{sale.numeroComprobante ?? `Venta #${sale.idVenta}`}</strong></div><span className={isPending ? styles.pending : styles.approved}>{payment.estado ?? 'APROBADO'}</span></div><div className={styles.receiptMeta}><Context label="Fecha" value={sale.fecha ? new Date(sale.fecha).toLocaleString() : new Date().toLocaleString()} /><Context label="Sucursal" value={sale.sucursal?.nombre ?? fallbackShift.caja.sucursal?.nombre ?? '—'} /><Context label="Cajero" value={[sale.cajero?.nombre ?? fallbackShift.cajero?.nombre, sale.cajero?.apellido ?? fallbackShift.cajero?.apellido].filter(Boolean).join(' ') || '—'} /><Context label="Turno" value={`#${sale.turno?.idTurno ?? fallbackShift.idTurno}`} /><Context label="Modalidad" value={sale.modalidadComercial ?? 'MINORISTA'} /><Context label="Método" value={payment.metodo} /></div><div className={styles.receiptLines}>{details.map(detail => <div key={detail.key}><span>{detail.name} {detail.sku && `· ${detail.sku}`} · {detail.quantity} unidades</span><strong>Bs {money(detail.subtotal)}</strong></div>)}</div><div className={styles.receiptTotals}><p><span>Total real</span><strong>Bs {money(total)}</strong></p>{payment.referenciaPasarela && <p><span>Referencia</span><strong>{payment.referenciaPasarela}</strong></p>}{received !== null && <><p><span>Recibido</span><strong>Bs {money(received)}</strong></p><p><span>Cambio</span><strong>Bs {money(received - total)}</strong></p></>}</div><button className={styles.checkout} type="button" onClick={onNewSale}>Nueva venta</button></article></section>
}

function priceForReceipt(line: CartLine, mode: Venta['modalidadComercial']) { return Number(mode === 'MAYORISTA' ? line.product.precioMayorista : line.product.precio) }
