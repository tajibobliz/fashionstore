import { useMemo, useState } from 'react'
import { WifiOff } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useCatalogoLocal, descontarStockLocal } from '../../offline/catalog'
import { encolar } from '../../offline/queue'
import { turnoLocal } from '../../offline/turno'
import dashboardStyles from '../dashboard/Dashboard.module.css'
import posStyles from '../pos/PosPage.module.css'
import styles from './Offline.module.css'

type Metodo = 'EFECTIVO' | 'QR' | 'TARJETA' | 'TRANSFERENCIA'
interface Linea { idVariante: number; nombre: string; sku: string; detalle: string; precio: number; stock: number; cantidad: number }
interface Guardada { codigo: string; total: number; recibido: number | null; lineas: Linea[]; metodo: Metodo }

const money = (n: number) => n.toFixed(2)
const hora = (iso: string) => new Date(iso).toLocaleString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

/**
 * Punto de venta sin conexión (Fase 2). Usa el turno y el catálogo guardados en el
 * dispositivo; cada venta se guarda en la cola y se envía sola al volver la red.
 * Solo modalidad MINORISTA: el precio mayorista y la búsqueda de clientes necesitan el servidor.
 */
export default function OfflinePos() {
  const { user } = useAuth()
  const turno = user ? turnoLocal.get(user.idUsuario) : null
  const catalogo = useCatalogoLocal(user?.idEmpresa, turno?.idSucursal)
  const [buscar, setBuscar] = useState('')
  const [carrito, setCarrito] = useState<Linea[]>([])
  const [cobro, setCobro] = useState(false)
  const [metodo, setMetodo] = useState<Metodo>('EFECTIVO')
  const [recibido, setRecibido] = useState('')
  const [referencia, setReferencia] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [guardada, setGuardada] = useState<Guardada | null>(null)

  const prendas = useMemo(() => (catalogo?.productos ?? []).flatMap(p => p.variantes.map(v => ({
    idVariante: v.idVariante, nombre: p.nombre, sku: v.sku, precio: p.precioFinal, stock: v.stockDisponible,
    detalle: `Talla: ${v.talla ?? 'Única'} · Color: ${v.color ?? '—'}`,
  }))), [catalogo])
  const filtro = buscar.trim().toLocaleLowerCase()
  const resultados = prendas.filter(p => `${p.nombre} ${p.sku}`.toLocaleLowerCase().includes(filtro))
  const total = carrito.reduce((t, l) => t + l.precio * l.cantidad, 0)

  const encabezado = <div className={dashboardStyles.pageHeading}><div><p className={dashboardStyles.kicker}>Punto de venta · sin conexión</p><h1>Nueva atención</h1></div></div>
  const aviso = <div className={styles.banner} role="status"><WifiOff size={18} aria-hidden="true" /><span><strong>Estás sin conexión.</strong> Las ventas se guardan en este dispositivo y se envían solas cuando vuelva internet. El stock mostrado es el de la última descarga.</span></div>

  if (!user || !turno || !catalogo) {
    return <section className={dashboardStyles.content}>{encabezado}{aviso}
      <p className={dashboardStyles.errorNotice} role="alert">
        {!turno ? 'No hay un turno guardado en este dispositivo.' : 'No hay un catálogo guardado de esta sucursal.'} Para vender sin conexión, abre el punto de venta una vez con internet y con el turno abierto: así se descargan el turno y el catálogo.
      </p>
    </section>
  }

  if (guardada) {
    return <section className={dashboardStyles.content}>{encabezado}
      <article className={posStyles.receipt}>
        <div className={posStyles.receiptHeader}><div><span>Venta guardada sin conexión</span><strong>Código {guardada.codigo}</strong></div><span className={posStyles.pending}>POR ENVIAR</span></div>
        <p>Se enviará al servidor al volver la conexión. Allí recibirá su número de comprobante definitivo.</p>
        <div className={posStyles.receiptLines}>{guardada.lineas.map(l => <div key={l.idVariante}><span>{l.nombre} · {l.sku} · {l.cantidad} unidades</span><strong>Bs {money(l.precio * l.cantidad)}</strong></div>)}</div>
        <div className={posStyles.receiptTotals}>
          <p><span>Total</span><strong>Bs {money(guardada.total)}</strong></p>
          <p><span>Método</span><strong>{guardada.metodo}</strong></p>
          {guardada.recibido !== null && <><p><span>Recibido</span><strong>Bs {money(guardada.recibido)}</strong></p><p><span>Cambio</span><strong>Bs {money(guardada.recibido - guardada.total)}</strong></p></>}
        </div>
        <button className={posStyles.checkout} type="button" onClick={() => { setGuardada(null); setBuscar('') }}>Nueva venta</button>
      </article>
    </section>
  }

  function agregar(p: Omit<Linea, 'cantidad'>) {
    setCarrito(actual => {
      const linea = actual.find(l => l.idVariante === p.idVariante)
      if (linea) return actual.map(l => l.idVariante === p.idVariante && l.cantidad < l.stock ? { ...l, cantidad: l.cantidad + 1 } : l)
      return p.stock > 0 ? [...actual, { ...p, cantidad: 1 }] : actual
    })
  }
  function cambiar(id: number, delta: number) {
    setCarrito(actual => actual.map(l => l.idVariante === id ? { ...l, cantidad: Math.max(1, Math.min(l.stock, l.cantidad + delta)) } : l))
  }

  async function guardar() {
    if (!user?.idEmpresa || !turno || !catalogo) return
    if (metodo === 'EFECTIVO' && Number(recibido) < total) { setError(`El monto recibido debe cubrir Bs ${money(total)}.`); return }
    setGuardando(true)
    setError('')
    try {
      const detalles = carrito.map(l => ({ idVariante: l.idVariante, cantidad: l.cantidad, precioUnitario: l.precio }))
      const prendasTotal = carrito.reduce((t, l) => t + l.cantidad, 0)
      const op = await encolar({
        type: 'VENTA', idEmpresa: user.idEmpresa, idUsuario: user.idUsuario, idSucursal: turno.idSucursal,
        resumen: `Venta · ${prendasTotal} ${prendasTotal === 1 ? 'prenda' : 'prendas'} · Bs ${money(total)}`,
        payload: {
          idTurno: turno.idTurno, idCaja: turno.idCaja, modalidadComercial: 'MINORISTA',
          catalogoDescargadoEn: catalogo.serverTime, metodoPago: metodo,
          ...(referencia.trim() ? { referenciaPago: referencia.trim() } : {}),
          detalles,
        },
      })
      await descontarStockLocal(user.idEmpresa, turno.idSucursal, detalles)
      setGuardada({ codigo: op.operationId.slice(0, 8), total, recibido: metodo === 'EFECTIVO' ? Number(recibido) : null, lineas: carrito, metodo })
      setCarrito([])
      setCobro(false)
    } catch {
      setError('No se pudo guardar la venta en este dispositivo.')
    } finally {
      setGuardando(false)
    }
  }

  return <section className={dashboardStyles.content}>
    {encabezado}{aviso}
    <div className={posStyles.contextGrid}>
      <Dato label="Sucursal" value={turno.sucursal} /><Dato label="Caja" value={turno.caja} /><Dato label="Turno" value={`#${turno.idTurno}`} />
      <Dato label="Cajero" value={turno.cajero || '—'} /><Dato label="Catálogo" value={`Descargado ${hora(catalogo.guardadoEn)}`} />
    </div>
    <div className={posStyles.workspace}>
      <section className={posStyles.catalogPanel}>
        <div className={posStyles.toolbar}><label className={posStyles.search}>Buscar por producto o SKU<input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Ej. vestido o SKU-001" /></label></div>
        <div className={posStyles.results}>{resultados.length ? resultados.map(p => {
          const enCarrito = carrito.find(l => l.idVariante === p.idVariante)?.cantidad ?? 0
          return <article className={posStyles.product} key={p.idVariante}>
            <div>
              <h3>{p.nombre}</h3>
              <p>{p.sku} · {p.detalle}</p>
              <p>Stock (última descarga): <strong>{p.stock}</strong></p>
              {p.stock === 1 && <p className={styles.lowStock}>Última unidad: confirma que la prenda está en tienda.</p>}
              <p>Precio: Bs {money(p.precio)}</p>
            </div>
            <button type="button" disabled={p.stock <= enCarrito} onClick={() => agregar(p)}>{p.stock ? 'Agregar' : 'Sin stock'}</button>
          </article>
        }) : <p className={dashboardStyles.emptyState}>{buscar ? 'No se encontraron productos.' : 'El catálogo guardado no tiene prendas.'}</p>}</div>
      </section>
      <aside className={posStyles.summary}>
        <h2>Resumen de venta</h2>
        {carrito.length ? <div className={posStyles.cartList}>{carrito.map(l => <article className={posStyles.cartItem} key={l.idVariante}>
          <div className={posStyles.cartItemHeader}><strong>{l.nombre}</strong><span>Bs {money(l.precio * l.cantidad)}</span></div>
          <p>{l.sku} · {l.cantidad} × Bs {money(l.precio)}</p>
          <div className={posStyles.quantity}>
            <button type="button" aria-label={`Disminuir ${l.nombre}`} onClick={() => cambiar(l.idVariante, -1)} disabled={l.cantidad <= 1}>−</button>
            <span>{l.cantidad}</span>
            <button type="button" aria-label={`Aumentar ${l.nombre}`} onClick={() => cambiar(l.idVariante, 1)} disabled={l.cantidad >= l.stock}>+</button>
            <button type="button" className={posStyles.remove} onClick={() => setCarrito(c => c.filter(x => x.idVariante !== l.idVariante))}>Eliminar</button>
          </div>
        </article>)}</div> : <p className={dashboardStyles.emptyState}>Todavía no agregaste productos.</p>}
        <div className={posStyles.total}><strong>Total</strong><strong>Bs {money(total)}</strong></div>
        <button className={posStyles.checkout} type="button" disabled={!carrito.length} onClick={() => { setRecibido(money(total)); setMetodo('EFECTIVO'); setReferencia(''); setError(''); setCobro(true) }}>Continuar al cobro</button>
        <p className={dashboardStyles.emptyState}>Modo sin conexión: solo venta minorista con los precios de la última descarga.</p>
      </aside>
    </div>
    {cobro && <div className={posStyles.checkoutBackdrop} role="presentation"><section className={posStyles.checkoutDialog} role="dialog" aria-modal="true" aria-labelledby="cobro-offline">
      <h2 id="cobro-offline">Cobro sin conexión</h2>
      <div className={posStyles.checkoutLines}>{carrito.map(l => <div key={l.idVariante}><span>{l.nombre} · {l.sku} · {l.cantidad} unidades</span><strong>Bs {money(l.precio * l.cantidad)}</strong></div>)}</div>
      <div className={posStyles.total}><strong>Total</strong><strong>Bs {money(total)}</strong></div>
      <label className={posStyles.cashField}>Método de pago<select value={metodo} onChange={e => setMetodo(e.target.value as Metodo)}><option value="EFECTIVO">EFECTIVO</option><option value="QR">QR</option><option value="TARJETA">TARJETA</option><option value="TRANSFERENCIA">TRANSFERENCIA</option></select></label>
      {metodo === 'EFECTIVO'
        ? <><label className={posStyles.cashField}>Monto recibido<input type="number" min="0" step="0.01" value={recibido} onChange={e => setRecibido(e.target.value)} /></label><p>Cambio: <strong>Bs {money(Math.max(0, Number(recibido || 0) - total))}</strong></p></>
        : <label className={posStyles.cashField}>Referencia o comprobante (opcional)<input maxLength={150} value={referencia} onChange={e => setReferencia(e.target.value)} /></label>}
      {error && <p className={dashboardStyles.errorNotice} role="alert">{error}</p>}
      <div className={posStyles.checkoutActions}>
        <button type="button" onClick={() => setCobro(false)} disabled={guardando}>Volver</button>
        <button className={posStyles.checkout} type="button" disabled={guardando || (metodo === 'EFECTIVO' && Number(recibido) < total)} onClick={() => void guardar()}>{guardando ? 'Guardando…' : 'Guardar venta'}</button>
      </div>
    </section></div>}
  </section>
}

function Dato({ label, value }: { label: string; value: string }) {
  return <div className={posStyles.contextItem}><span>{label}</span><strong>{value}</strong></div>
}
