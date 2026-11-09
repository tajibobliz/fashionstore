import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Minus, Plus, ShoppingBag, Trash2, WifiOff } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useModoOffline } from '../../offline/sesionOffline'
import { BannerModoOffline } from './PinOffline'
import { useStore } from '../store/storeContext'
import { Brand } from '../../components/common/Brand'
import { useCatalogosEmpresa, descontarStockLocal } from '../../offline/catalog'
import { encolar } from '../../offline/queue'
import { MAX_POR_PRENDA, agregarAlCarrito, cambiarCantidad, totalCarrito, useCarrito, vaciarCarrito } from '../../offline/carrito'
import styles from './Offline.module.css'
import { ProductImage } from '../../components/ui/ProductImage'
import { formatMoney } from '../../utils/money'

const hora = (iso: string) => new Date(iso).toLocaleString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

/**
 * Tienda sin conexión para la clienta: ve el catálogo guardado de cada sucursal y deja
 * reservas en cola. Al volver la red se envían; si la prenda ya no está, el servidor
 * responde CONFLICTO y sugiere otra sucursal (se ve en el indicador de abajo a la izquierda).
 * En el plan Empresarial además arma un carrito offline (CU15) y lo confirma como pedido
 * con pago diferido (CU16).
 */
export default function OfflineStore() {
  const { user, status } = useAuth()
  // CU17: plazo offline. Vencido, la clienta solo consulta el catálogo.
  const modo = useModoOffline(user)
  const { base } = useStore()
  const catalogos = useCatalogosEmpresa(user?.idEmpresa)
  const [idSucursal, setIdSucursal] = useState<number | null>(null)
  const [mensaje, setMensaje] = useState('')
  const [enviando, setEnviando] = useState<number | null>(null)

  const catalogo = catalogos?.find(c => c.sucursal.idSucursal === idSucursal) ?? catalogos?.[0]
  const aviso = <div className={styles.banner} role="status"><WifiOff size={18} aria-hidden="true" /><span><strong>Estás sin conexión.</strong> Puedes ver el catálogo guardado y dejar {catalogo?.tienda?.pagoDiferido ? 'reservas o pedidos' : 'reservas'}: se envían solos cuando vuelva internet.</span></div>

  const tienda = catalogo?.tienda
  const dinero = (n: number) => formatMoney(n, tienda?.moneda)
  const dueño = user?.idEmpresa && catalogo ? { idEmpresa: user.idEmpresa, idUsuario: user.idUsuario, idSucursal: catalogo.sucursal.idSucursal } : null
  const carrito = useCarrito(dueño ?? {})
  const stockLocal = new Map(catalogo?.productos.flatMap(p => p.variantes.map(v => [v.idVariante, v.stockDisponible] as const)) ?? [])

  /**
   * Confirmar el carrito (CU15 → CU16): un solo pedido con pago diferido (ORDEN_PAGO_DIFERIDO) con
   * todas las prendas y los precios que vio la clienta. Al volver la red el servidor lo registra
   * (o avisa si falta stock o cambió el precio) y ella lo paga.
   */
  async function confirmarCarrito() {
    if (!user?.idEmpresa || !catalogo || !dueño || !carrito?.length) return
    setEnviando(-1)
    try {
      const detalles = carrito.map(i => ({ idVariante: i.idVariante, cantidad: i.cantidad, precioUnitario: i.precioUnitario }))
      const unidades = carrito.reduce((n, i) => n + i.cantidad, 0)
      await encolar({
        type: 'ORDEN_PAGO_DIFERIDO', idEmpresa: user.idEmpresa, idUsuario: user.idUsuario, idSucursal: catalogo.sucursal.idSucursal,
        resumen: `Pedido · ${unidades} ${unidades === 1 ? 'prenda' : 'prendas'} · ${dinero(totalCarrito(carrito))} · ${catalogo.sucursal.nombre}`,
        payload: { detalles, catalogoDescargadoEn: catalogo.serverTime },
      })
      await descontarStockLocal(user.idEmpresa, catalogo.sucursal.idSucursal, detalles)
      await vaciarCarrito(dueño)
      setMensaje(`Pedido guardado localmente. El pago se completará cuando haya conexión: tendrás ${tienda?.horasParaPagar ?? 48} horas para pagarlo.`)
    } catch (e) {
      setMensaje((e as Error).message)
    } finally {
      setEnviando(null)
    }
  }

  async function reservar(idVariante: number, nombre: string, detalle: string) {
    if (!user?.idEmpresa || !catalogo) return
    setEnviando(idVariante)
    try {
      const items = [{ idVariante, cantidad: 1 }]
      await encolar({
        type: 'RESERVA', idEmpresa: user.idEmpresa, idUsuario: user.idUsuario, idSucursal: catalogo.sucursal.idSucursal,
        resumen: `Reserva · ${nombre} (${detalle}) · ${catalogo.sucursal.nombre}`,
        payload: { detalles: items },
      })
      await descontarStockLocal(user.idEmpresa, catalogo.sucursal.idSucursal, items)
      setMensaje(`Reserva de ${nombre} guardada. Se enviará a ${catalogo.sucursal.nombre} cuando vuelva la conexión.`)
    } finally {
      setEnviando(null)
    }
  }

  return <div className={styles.store}>
    <header className="workspace-header"><Brand /></header>
    <main className={styles.storeMain}>
      {aviso}
      <BannerModoOffline modo={modo} />
      {status === 'loading' || (user && catalogos === undefined)
        ? <p role="status">Cargando el catálogo guardado…</p>
        : !user
        ? <p>Para reservar sin conexión, <Link to={`${base}/login`}>entra con tu PIN</Link> si activaste el acceso sin conexión en este navegador; si no, inicia sesión cuando tengas internet.</p>
        : !catalogos?.length
          ? <p>No hay un catálogo guardado en este dispositivo. Entra a la tienda una vez con internet y con tu sesión iniciada para poder usarla sin conexión.</p>
          : catalogo && <>
            <div className={styles.storeHead}>
              <div><p className="eyebrow">Catálogo guardado · {hora(catalogo.guardadoEn)}</p><h1>{catalogo.sucursal.nombre}</h1></div>
              <label>Sucursal<select value={catalogo.sucursal.idSucursal} onChange={e => { setIdSucursal(Number(e.target.value)); setMensaje('') }}>
                {catalogos.map(c => <option key={c.clave} value={c.sucursal.idSucursal}>{c.sucursal.nombre}</option>)}
              </select></label>
            </div>
            {tienda?.pagoDiferido && <p className={styles.nota}><strong>Al carrito</strong>: arma tu pedido y págalo cuando vuelva la conexión (tienes {tienda.horasParaPagar} h). <strong>Reservar</strong>: apartas la prenda para pagarla en la tienda. Precio y stock se confirman al sincronizar.</p>}
            {mensaje && <p className={styles.feedback} role="status">{mensaje}</p>}
            <div className={tienda?.pagoDiferido ? styles.conCarrito : undefined}>
            <div className={styles.grid}>{catalogo.productos.map(p => <article className={styles.card} key={p.idProducto}>
              <div className={styles.foto}><ProductImage src={p.imagenUrl ?? undefined} name={p.nombre} /></div>
              <div><p>{p.categoria ?? 'Moda'}</p><h2>{p.nombre}</h2></div>
              <span className={styles.price}>{dinero(p.precioFinal)}</span>
              <div className={styles.variants}>{p.variantes.map(v => {
                const detalle = [v.talla ?? 'Única', v.color].filter(Boolean).join(' / ')
                return <div className={styles.variant} key={v.idVariante}>
                  <span>{detalle} · {v.stockDisponible ? `${v.stockDisponible} disp.` : 'sin stock'}</span>
                  <span className={styles.variantActions}>
                    <button type="button" disabled={!v.stockDisponible || enviando === v.idVariante || modo.vencido} onClick={() => void reservar(v.idVariante, p.nombre, detalle)}>Reservar</button>
                    {tienda?.pagoDiferido && dueño && <button type="button" className={styles.pedir} disabled={!v.stockDisponible || modo.vencido} onClick={() => { setMensaje(''); void agregarAlCarrito(dueño, { idVariante: v.idVariante, nombre: p.nombre, detalle, precioUnitario: p.precioFinal }) }}>Al carrito</button>}
                  </span>
                </div>
              })}</div>
            </article>)}</div>
            {tienda?.pagoDiferido && dueño && <aside className={styles.carrito} aria-label="Carrito sin conexión">
              <h2><ShoppingBag size={18} aria-hidden="true" /> Tu carrito{carrito?.length ? ` (${carrito.reduce((n, i) => n + i.cantidad, 0)})` : ''}</h2>
              {!carrito?.length
                ? <p className={styles.carritoVacio}>Agrega prendas con <strong>Al carrito</strong>. Se guarda en este dispositivo aunque cierres el navegador.</p>
                : <>
                  <ul className={styles.carritoLista}>{carrito.map(i => {
                    const disponible = stockLocal.get(i.idVariante) ?? 0
                    return <li key={i.idVariante}>
                      <div className={styles.carritoItem}>
                        <span><strong>{i.nombre}</strong><small>{i.detalle} · {dinero(i.precioUnitario)} c/u</small></span>
                        <strong>{dinero(i.precioUnitario * i.cantidad)}</strong>
                      </div>
                      <div className={styles.carritoControles}>
                        <button type="button" aria-label={`Quitar una unidad de ${i.nombre}`} disabled={modo.vencido} onClick={() => void cambiarCantidad(dueño, i.idVariante, i.cantidad - 1)}><Minus size={14} /></button>
                        <span aria-label="Cantidad">{i.cantidad}</span>
                        <button type="button" aria-label={`Agregar una unidad de ${i.nombre}`} disabled={modo.vencido || i.cantidad >= MAX_POR_PRENDA} onClick={() => void cambiarCantidad(dueño, i.idVariante, i.cantidad + 1)}><Plus size={14} /></button>
                        <button type="button" className={styles.carritoQuitar} aria-label={`Quitar ${i.nombre} del carrito`} onClick={() => void cambiarCantidad(dueño, i.idVariante, 0)}><Trash2 size={14} /></button>
                      </div>
                      {i.cantidad > disponible && <p className={styles.carritoAviso}>Stock local referencial: el catálogo guardado indica {disponible} disponibles. Puedes continuar; se confirma al sincronizar.</p>}
                    </li>
                  })}</ul>
                  <div className={styles.carritoTotal}><span>Total estimado</span><strong>{dinero(totalCarrito(carrito))}</strong></div>
                  <p className={styles.carritoNota}>El total final se confirma al sincronizar con los precios vigentes. Los cupones solo se aplican con conexión.</p>
                  <button type="button" className={styles.carritoConfirmar} disabled={enviando === -1 || modo.vencido} onClick={() => void confirmarCarrito()}>{enviando === -1 ? 'Guardando…' : 'Confirmar pedido'}</button>
                  <button type="button" className={styles.carritoVaciar} onClick={() => void vaciarCarrito(dueño)}>Vaciar carrito</button>
                </>}
            </aside>}
            </div>
          </>}
    </main>
  </div>
}
