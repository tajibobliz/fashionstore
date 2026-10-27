import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { exchangesApi } from '../../api/exchanges.api'
import type { LineaCambiable } from '../../api/exchanges.api'
import { salesApi } from '../../api/sales.api'
import { syncApi } from '../../api/sync.api'
import { queryKeys } from '../../api/queryKeys'
import { useAuth } from '../../hooks/useAuth'
import { getApiErrorMessage } from '../../utils/apiError'
import dashboardStyles from '../dashboard/Dashboard.module.css'
import styles from './Exchanges.module.css'

type Seleccion = Record<number, { cantidad: string; idVarianteNueva: string }>
const money = (n: number) => n.toFixed(2)
const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })
const prenda = (v: LineaCambiable['variante']) => `${v.producto ?? v.sku} (${[v.talla, v.color].filter(Boolean).join(' / ') || v.sku})`

/**
 * Cambios de prendas (Fase 2, tarea 2.5): la clienta trae prendas de una compra y se lleva
 * otras (otra talla, color o producto) dentro del plazo de la empresa. El sistema devuelve
 * la original al stock, descuenta la nueva y calcula la diferencia de precio.
 */
export default function ExchangesPage() {
  const client = useQueryClient()
  const { user } = useAuth()
  const esAdmin = user?.rol === 'ADMIN'
  const [buscarCliente, setBuscarCliente] = useState('')
  const [numero, setNumero] = useState('')
  const [idVenta, setIdVenta] = useState<number | null>(null)
  const [seleccion, setSeleccion] = useState<Seleccion>({})
  const [metodo, setMetodo] = useState('')
  const [motivo, setMotivo] = useState('')
  const [aviso, setAviso] = useState('')
  const [plazoEditado, setPlazoEditado] = useState<string | null>(null)

  const politica = useQuery({ queryKey: ['exchanges', 'politica'], queryFn: exchangesApi.politica })
  const coincidencias = useQuery({ queryKey: ['exchanges', 'cliente', buscarCliente], queryFn: () => salesApi.searchClient(buscarCliente), enabled: buscarCliente.trim().length >= 2, retry: false })
  const venta = useQuery({ queryKey: ['exchanges', 'venta', idVenta], queryFn: () => exchangesApi.venta(idVenta!), enabled: !!idVenta, retry: false })
  const idSucursal = venta.data?.venta.sucursal.idSucursal
  const catalogo = useQuery({ queryKey: ['exchanges', 'catalogo', idSucursal], queryFn: () => syncApi.catalogo(idSucursal!), enabled: !!idSucursal })

  // Opciones de prenda nueva: variantes con su precio vigente y stock en la sucursal de la venta.
  const opciones = useMemo(() => (catalogo.data?.productos ?? []).flatMap(p => p.variantes.map(v => ({
    idVariante: v.idVariante, idProducto: p.idProducto, precio: p.precioFinal, stock: v.stockDisponible,
    etiqueta: `${p.nombre} · ${[v.talla ?? 'Única', v.color].filter(Boolean).join(' / ')} · Bs ${money(p.precioFinal)} · stock ${v.stockDisponible}`,
  }))), [catalogo.data])
  const porId = useMemo(() => new Map(opciones.map(o => [o.idVariante, o])), [opciones])

  const lineas = (venta.data?.detalles ?? []).flatMap(d => {
    const s = seleccion[d.idDetalleVenta]
    const cantidad = Number(s?.cantidad ?? 0)
    const nueva = s?.idVarianteNueva ? porId.get(Number(s.idVarianteNueva)) : undefined
    return cantidad > 0 && nueva ? [{ d, cantidad, nueva, diferencia: (nueva.precio - d.precioUnitario) * cantidad }] : []
  })
  const diferencia = lineas.reduce((t, l) => t + l.diferencia, 0)
  const quedanUnidades = (venta.data?.detalles ?? []).some(d => d.disponibles > 0)
  const puedeCambiar = !!venta.data?.dentroDelPlazo && !!venta.data?.admiteCambio && quedanUnidades

  const registrar = useMutation({
    mutationFn: () => exchangesApi.crear({
      idVenta: idVenta!,
      ...(motivo.trim() ? { motivo: motivo.trim() } : {}),
      ...(diferencia > 0 ? { metodoPagoDiferencia: metodo } : {}),
      detalles: lineas.map(l => ({ idDetalleVenta: l.d.idDetalleVenta, cantidad: l.cantidad, idVarianteNueva: l.nueva.idVariante })),
    }),
    onSuccess: cambio => {
      const dif = cambio.diferencia
      setAviso(`Cambio registrado. ${dif > 0 ? `La clienta pagó Bs ${money(dif)} (${cambio.metodoPagoDiferencia}).` : dif < 0 ? `Se devuelven Bs ${money(-dif)} a la clienta.` : 'Sin diferencia de precio.'}`)
      setSeleccion({}); setMetodo(''); setMotivo('')
      void Promise.all([
        client.invalidateQueries({ queryKey: ['exchanges'] }),
        client.invalidateQueries({ queryKey: queryKeys.inventory.all }),
      ])
    },
  })
  const guardarPlazo = useMutation({
    mutationFn: (dias: number) => exchangesApi.guardarPolitica(dias),
    onSuccess: () => { setPlazoEditado(null); void client.invalidateQueries({ queryKey: ['exchanges'] }) },
  })

  function abrir(id: number) { setIdVenta(id); setNumero(String(id)); setSeleccion({}); setAviso(''); registrar.reset() }
  function cambiarLinea(id: number, cambios: Partial<Seleccion[number]>) {
    setSeleccion(actual => ({ ...actual, [id]: { cantidad: actual[id]?.cantidad ?? '', idVarianteNueva: actual[id]?.idVarianteNueva ?? '', ...cambios } }))
  }

  const v = venta.data
  return <section className={dashboardStyles.content}>
    <div className={dashboardStyles.pageHeading}><div>
      <p className={dashboardStyles.kicker}>Atención postventa</p>
      <h1>Cambios de prendas</h1>
      <p>La clienta trae una prenda y se lleva otra talla, otro color u otro producto, dentro del plazo de la tienda.</p>
    </div></div>

    {politica.data && <div className={styles.policy}>
      <span>Plazo de cambio: <strong>{politica.data.plazoCambioDias ? `${politica.data.plazoCambioDias} días desde la compra` : 'la tienda no acepta cambios'}</strong></span>
      {esAdmin && (plazoEditado === null
        ? <button type="button" onClick={() => setPlazoEditado(String(politica.data.plazoCambioDias))}>Cambiar plazo</button>
        : <form onSubmit={e => { e.preventDefault(); guardarPlazo.mutate(Number(plazoEditado)) }}>
          <label htmlFor="plazo-dias">Días</label>
          <input id="plazo-dias" type="number" min={0} max={90} required value={plazoEditado} onChange={e => setPlazoEditado(e.target.value)} />
          <button type="submit" disabled={guardarPlazo.isPending}>Guardar</button>
          <button type="button" onClick={() => setPlazoEditado(null)}>Cancelar</button>
        </form>)}
      {guardarPlazo.error && <span className={dashboardStyles.errorNotice}>{getApiErrorMessage(guardarPlazo.error)}</span>}
    </div>}

    <label className={dashboardStyles.searchField}>Buscar cliente<input aria-label="Buscar cliente" value={buscarCliente} onChange={e => setBuscarCliente(e.target.value)} placeholder="Nombre o correo" /></label>
    {!!coincidencias.data?.length && <div className={styles.matches}>{coincidencias.data.map(item => <button className={styles.secondary} type="button" key={item.idVenta} onClick={() => abrir(item.idVenta)}>
      {item.numeroComprobante ?? `Venta #${item.idVenta}`} · {item.usuario?.nombre ?? 'Cliente'}
    </button>)}</div>}
    <form className={dashboardStyles.registrationForm} onSubmit={e => { e.preventDefault(); if (Number(numero) > 0) abrir(Number(numero)) }}>
      <label>Número de venta<input aria-label="Número de venta" type="number" min="1" required value={numero} onChange={e => setNumero(e.target.value)} /></label>
      <button className="primary-button" type="submit">Buscar venta</button>
    </form>

    {aviso && <p className={styles.notice} role="status">{aviso}</p>}
    {venta.isLoading && <div className={dashboardStyles.chartLoading} role="status">Buscando venta…</div>}
    {venta.error && <p className={dashboardStyles.errorNotice} role="alert">{getApiErrorMessage(venta.error)}</p>}

    {v && <article className={dashboardStyles.panel}>
      <div className={dashboardStyles.panelHeader}>
        <div><h2>{v.venta.numeroComprobante ?? `Venta #${v.venta.idVenta}`}</h2><p>{fecha(v.venta.fecha)} · {v.venta.sucursal.nombre} · {v.venta.estado}</p></div>
        <span className={`${styles.badge} ${v.dentroDelPlazo ? styles.ok : styles.bad}`}>
          {v.dentroDelPlazo ? `Dentro del plazo · hasta el ${fecha(v.venceEl)}` : v.plazoCambioDias ? `Fuera de plazo · venció el ${fecha(v.venceEl)}` : 'La tienda no acepta cambios'}
        </span>
      </div>
      <p className={styles.meta}>Cliente: <strong>{v.venta.cliente ? `${v.venta.cliente.nombre} · ${v.venta.cliente.email}` : 'sin cuenta'}</strong> · Total Bs {money(Number(v.venta.total))}</p>
      {!v.admiteCambio && <p className={dashboardStyles.errorNotice}>Esta venta no admite cambios por su estado ({v.venta.estado}).</p>}
      {v.admiteCambio && v.dentroDelPlazo && !quedanUnidades && <p className={styles.meta}>Todas las prendas de esta venta ya se cambiaron o devolvieron.</p>}

      {puedeCambiar && <>
        <div className={dashboardStyles.tableWrap}><table className={`${dashboardStyles.table} ${styles.table}`}>
          <thead><tr><th>Prenda comprada</th><th>Pagado</th><th>Disponibles</th><th>Cambiar</th><th>Se lleva</th><th>Diferencia</th></tr></thead>
          <tbody>{v.detalles.map(d => {
            const s = seleccion[d.idDetalleVenta]
            const nueva = s?.idVarianteNueva ? porId.get(Number(s.idVarianteNueva)) : undefined
            const cantidad = Number(s?.cantidad ?? 0)
            const dif = nueva && cantidad ? (nueva.precio - d.precioUnitario) * cantidad : 0
            const mismas = opciones.filter(o => o.idProducto === d.variante.idProducto)
            const otras = opciones.filter(o => o.idProducto !== d.variante.idProducto)
            return <tr key={d.idDetalleVenta}>
              <td>{prenda(d.variante)}<br /><small>{d.cantidad} comprada(s){d.devueltas ? ` · ${d.devueltas} devuelta(s)` : ''}{d.cambiadas ? ` · ${d.cambiadas} cambiada(s)` : ''}</small></td>
              <td>Bs {money(d.precioUnitario)}</td>
              <td>{d.disponibles}</td>
              <td><input aria-label={`Unidades a cambiar de ${prenda(d.variante)}`} type="number" min={0} max={d.disponibles} disabled={!d.disponibles} value={s?.cantidad ?? ''}
                onChange={e => cambiarLinea(d.idDetalleVenta, { cantidad: String(Math.min(d.disponibles, Math.max(0, Number(e.target.value)))) })} /></td>
              <td><select aria-label={`Prenda nueva para ${prenda(d.variante)}`} disabled={!d.disponibles} value={s?.idVarianteNueva ?? ''} onChange={e => cambiarLinea(d.idDetalleVenta, { idVarianteNueva: e.target.value })}>
                <option value="">Elegir prenda…</option>
                {mismas.length > 0 && <optgroup label="Mismo producto">{mismas.map(o => <option key={o.idVariante} value={o.idVariante} disabled={o.stock < Math.max(1, cantidad)}>{o.etiqueta}</option>)}</optgroup>}
                {otras.length > 0 && <optgroup label="Otros productos">{otras.map(o => <option key={o.idVariante} value={o.idVariante} disabled={o.stock < Math.max(1, cantidad)}>{o.etiqueta}</option>)}</optgroup>}
              </select></td>
              <td className={`${styles.diff} ${dif > 0 ? styles.up : dif < 0 ? styles.down : ''}`}>{nueva && cantidad ? `${dif > 0 ? '+' : ''}Bs ${money(dif)}` : '—'}</td>
            </tr>
          })}</tbody>
        </table></div>

        <div className={styles.summary}>
          <p className={styles.total}>{!lineas.length ? 'Elige cuántas unidades cambiar y la prenda nueva.' : diferencia > 0 ? <>La clienta paga <strong>Bs {money(diferencia)}</strong> de diferencia.</> : diferencia < 0 ? <>Se devuelven <strong>Bs {money(-diferencia)}</strong> a la clienta.</> : <>Sin diferencia de precio.</>}</p>
          {diferencia > 0 && <label>Cómo paga la diferencia<select value={metodo} onChange={e => setMetodo(e.target.value)} required><option value="">Elegir…</option><option value="EFECTIVO">EFECTIVO</option><option value="QR">QR</option><option value="TARJETA">TARJETA</option><option value="TRANSFERENCIA">TRANSFERENCIA</option></select></label>}
          <label>Motivo (opcional)<input maxLength={300} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej. le quedaba chica" /></label>
          {registrar.error && <p className={dashboardStyles.errorNotice} role="alert">{getApiErrorMessage(registrar.error)}</p>}
          <button className="primary-button" type="button" disabled={!lineas.length || registrar.isPending || (diferencia > 0 && !metodo)} onClick={() => registrar.mutate()}>
            {registrar.isPending ? 'Registrando…' : 'Registrar cambio'}
          </button>
        </div>
      </>}

      {v.cambios.length > 0 && <div className={styles.history}>
        <h3>Cambios de esta venta</h3>
        <ul>{v.cambios.map(c => <li key={c.idCambio}>
          {c.detalles.map((d, i) => <div key={i}>{d.cantidad} × {d.devuelve} → <strong>{d.entrega}</strong></div>)}
          <small>{fecha(c.fecha)} · {c.registradoPor ?? '—'} · {c.diferencia > 0 ? `cobró Bs ${money(c.diferencia)} (${c.metodoPagoDiferencia})` : c.diferencia < 0 ? `devolvió Bs ${money(-c.diferencia)}` : 'sin diferencia'}{c.motivo ? ` · ${c.motivo}` : ''}</small>
        </li>)}</ul>
      </div>}
    </article>}
  </section>
}
