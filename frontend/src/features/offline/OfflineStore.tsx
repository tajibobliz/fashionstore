import { useState } from 'react'
import { Link } from 'react-router-dom'
import { WifiOff } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useStore } from '../store/storeContext'
import { Brand } from '../../components/common/Brand'
import { useCatalogosEmpresa, descontarStockLocal } from '../../offline/catalog'
import { encolar } from '../../offline/queue'
import styles from './Offline.module.css'

const hora = (iso: string) => new Date(iso).toLocaleString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

/**
 * Tienda sin conexión para la clienta: ve el catálogo guardado de cada sucursal y deja
 * reservas en cola. Al volver la red se envían; si la prenda ya no está, el servidor
 * responde CONFLICTO y sugiere otra sucursal (se ve en el indicador de abajo a la izquierda).
 */
export default function OfflineStore() {
  const { user, status } = useAuth()
  const { base } = useStore()
  const catalogos = useCatalogosEmpresa(user?.idEmpresa)
  const [idSucursal, setIdSucursal] = useState<number | null>(null)
  const [mensaje, setMensaje] = useState('')
  const [enviando, setEnviando] = useState<number | null>(null)

  const catalogo = catalogos?.find(c => c.sucursal.idSucursal === idSucursal) ?? catalogos?.[0]
  const aviso = <div className={styles.banner} role="status"><WifiOff size={18} aria-hidden="true" /><span><strong>Estás sin conexión.</strong> Puedes ver el catálogo guardado y dejar reservas: se envían solas cuando vuelva internet.</span></div>

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
      {status === 'loading' || (user && catalogos === undefined)
        ? <p role="status">Cargando el catálogo guardado…</p>
        : !user
        ? <p>Para reservar sin conexión, primero <Link to={`${base}/login`}>inicia sesión</Link> con internet.</p>
        : !catalogos?.length
          ? <p>No hay un catálogo guardado en este dispositivo. Entra a la tienda una vez con internet y con tu sesión iniciada para poder usarla sin conexión.</p>
          : catalogo && <>
            <div className={styles.storeHead}>
              <div><p className="eyebrow">Catálogo guardado · {hora(catalogo.guardadoEn)}</p><h1>{catalogo.sucursal.nombre}</h1></div>
              <label>Sucursal<select value={catalogo.sucursal.idSucursal} onChange={e => { setIdSucursal(Number(e.target.value)); setMensaje('') }}>
                {catalogos.map(c => <option key={c.clave} value={c.sucursal.idSucursal}>{c.sucursal.nombre}</option>)}
              </select></label>
            </div>
            {mensaje && <p className={styles.feedback} role="status">{mensaje}</p>}
            <div className={styles.grid}>{catalogo.productos.map(p => <article className={styles.card} key={p.idProducto}>
              <div><p>{p.categoria ?? 'Moda'}</p><h2>{p.nombre}</h2></div>
              <span className={styles.price}>Bs {p.precioFinal.toFixed(2)}</span>
              <div className={styles.variants}>{p.variantes.map(v => {
                const detalle = [v.talla ?? 'Única', v.color].filter(Boolean).join(' / ')
                return <div className={styles.variant} key={v.idVariante}>
                  <span>{detalle} · {v.stockDisponible ? `${v.stockDisponible} disp.` : 'sin stock'}</span>
                  <button type="button" disabled={!v.stockDisponible || enviando === v.idVariante} onClick={() => void reservar(v.idVariante, p.nombre, detalle)}>Reservar</button>
                </div>
              })}</div>
            </article>)}</div>
          </>}
    </main>
  </div>
}
