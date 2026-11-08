import { useState } from 'react'
import { Link } from 'react-router-dom'
import { WifiOff } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useModoOffline } from '../../offline/sesionOffline'
import { BannerModoOffline } from './PinOffline'
import { useStore } from '../store/storeContext'
import { Brand } from '../../components/common/Brand'
import { useCatalogosEmpresa, descontarStockLocal } from '../../offline/catalog'
import { encolar } from '../../offline/queue'
import styles from './Offline.module.css'
import { formatMoney } from '../../utils/money'

const hora = (iso: string) => new Date(iso).toLocaleString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

/**
 * Tienda sin conexión para la clienta: ve el catálogo guardado de cada sucursal y deja
 * reservas en cola. Al volver la red se envían; si la prenda ya no está, el servidor
 * responde CONFLICTO y sugiere otra sucursal (se ve en el indicador de abajo a la izquierda).
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

  /**
   * Pedido con pago diferido (CU16, plan Empresarial): queda en la cola como ORDEN_PAGO_DIFERIDO
   * con el precio que ve la clienta; al volver la red el servidor lo registra y ella lo paga.
   */
  async function pedir(idVariante: number, nombre: string, detalle: string, precioFinal: number) {
    if (!user?.idEmpresa || !catalogo) return
    setEnviando(idVariante)
    try {
      const items = [{ idVariante, cantidad: 1, precioUnitario: precioFinal }]
      await encolar({
        type: 'ORDEN_PAGO_DIFERIDO', idEmpresa: user.idEmpresa, idUsuario: user.idUsuario, idSucursal: catalogo.sucursal.idSucursal,
        resumen: `Pedido · ${nombre} (${detalle}) · ${dinero(precioFinal)} · ${catalogo.sucursal.nombre}`,
        payload: { detalles: items, catalogoDescargadoEn: catalogo.serverTime },
      })
      await descontarStockLocal(user.idEmpresa, catalogo.sucursal.idSucursal, items)
      setMensaje(`Pedido guardado localmente. El pago se completará cuando haya conexión: tendrás ${tienda?.horasParaPagar ?? 48} horas para pagar ${nombre}.`)
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
            {tienda?.pagoDiferido && <p className={styles.nota}><strong>Pedir</strong>: compras ahora y pagas cuando vuelva la conexión (tienes {tienda.horasParaPagar} h). <strong>Reservar</strong>: apartas la prenda para pagarla en la tienda. Precio y stock se confirman al sincronizar.</p>}
            {mensaje && <p className={styles.feedback} role="status">{mensaje}</p>}
            <div className={styles.grid}>{catalogo.productos.map(p => <article className={styles.card} key={p.idProducto}>
              <div><p>{p.categoria ?? 'Moda'}</p><h2>{p.nombre}</h2></div>
              <span className={styles.price}>{dinero(p.precioFinal)}</span>
              <div className={styles.variants}>{p.variantes.map(v => {
                const detalle = [v.talla ?? 'Única', v.color].filter(Boolean).join(' / ')
                return <div className={styles.variant} key={v.idVariante}>
                  <span>{detalle} · {v.stockDisponible ? `${v.stockDisponible} disp.` : 'sin stock'}</span>
                  <span className={styles.variantActions}>
                    <button type="button" disabled={!v.stockDisponible || enviando === v.idVariante || modo.vencido} onClick={() => void reservar(v.idVariante, p.nombre, detalle)}>Reservar</button>
                    {tienda?.pagoDiferido && <button type="button" className={styles.pedir} disabled={!v.stockDisponible || enviando === v.idVariante || modo.vencido} onClick={() => void pedir(v.idVariante, p.nombre, detalle, p.precioFinal)}>Pedir</button>}
                  </span>
                </div>
              })}</div>
            </article>)}</div>
          </>}
    </main>
  </div>
}
