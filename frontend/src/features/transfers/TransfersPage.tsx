import { useDeferredValue, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, History, PackageCheck, Send } from 'lucide-react'
import { transfersApi } from '../../api/transfers.api'
import type { EstadoTraspaso, Traspaso } from '../../api/transfers.api'
import { queryKeys } from '../../api/queryKeys'
import { getApiErrorMessage } from '../../utils/apiError'
import dashboardStyles from '../dashboard/Dashboard.module.css'
import styles from './Transfers.module.css'

type Pestana = 'recibir' | 'nuevo' | 'historial'

const ESTADOS: Record<EstadoTraspaso, { texto: string; clase: string }> = {
  EN_TRANSITO: { texto: 'En tránsito', clase: styles.transito },
  RECIBIDO: { texto: 'Recibido', clase: styles.recibido },
  RECIBIDO_PARCIAL: { texto: 'Recibido con merma', clase: styles.parcial },
  RECHAZADO: { texto: 'Rechazado', clase: styles.rechazado },
  CANCELADO: { texto: 'Cancelado', clase: styles.cancelado },
}
const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

function Estado({ estado }: { estado: EstadoTraspaso }) {
  return <span className={`${styles.estado} ${ESTADOS[estado].clase}`}>{ESTADOS[estado].texto}</span>
}

/**
 * Traspasos entre sucursales (CU14): la sucursal de origen envía prendas (salen de su stock y
 * quedan "En tránsito"); la de destino confirma lo que llegó y lo que no llegó queda como merma.
 */
export default function TransfersPage() {
  const pendientes = useQuery({ queryKey: ['transfers', 'pendientes'], queryFn: transfersApi.pendientes, refetchInterval: 60_000 })
  const porRecibir = pendientes.data?.porRecibir ?? 0
  const [elegida, setElegida] = useState<Pestana | null>(null)
  // La pestaña inicial se decide una sola vez (al cargar): si luego se recibe el último
  // pendiente, la pantalla no salta sola a otra pestaña.
  if (elegida === null && pendientes.data) setElegida(porRecibir > 0 ? 'recibir' : 'nuevo')
  const pestana: Pestana = elegida ?? 'nuevo'

  const pestanas: { id: Pestana; texto: string; icono: typeof Send }[] = [
    { id: 'recibir', texto: 'En tránsito', icono: PackageCheck },
    { id: 'nuevo', texto: 'Nuevo traspaso', icono: Send },
    { id: 'historial', texto: 'Historial', icono: History },
  ]

  return <section className={dashboardStyles.content}>
    <div className={dashboardStyles.pageHeading}><div>
      <p className={dashboardStyles.kicker}>Inventario entre sucursales</p>
      <h1>Traspasos</h1>
      <p>Mueve prendas de una sucursal a otra. El stock sale del origen al enviar y entra al destino cuando lo recibe.</p>
    </div></div>

    {porRecibir > 0 && pestana !== 'recibir' && <button type="button" className={styles.alerta} onClick={() => setElegida('recibir')}>
      <PackageCheck size={18} /> {porRecibir === 1 ? 'Hay 1 traspaso por recibir' : `Hay ${porRecibir} traspasos por recibir`} en tus sucursales <ArrowRight size={16} />
    </button>}

    <div className={styles.tabs} role="tablist" aria-label="Secciones de traspasos">
      {pestanas.map(({ id, texto, icono: Icono }) =>
        <button key={id} type="button" role="tab" aria-selected={pestana === id} className={pestana === id ? styles.tabActive : undefined} onClick={() => setElegida(id)}>
          <Icono size={16} />{texto}{id === 'recibir' && porRecibir > 0 && <span className={styles.contador}>{porRecibir}</span>}
        </button>)}
    </div>

    {pestana === 'recibir' && <EnTransito />}
    {pestana === 'nuevo' && <NuevoTraspaso alEnviar={() => setElegida('recibir')} />}
    {pestana === 'historial' && <Historial />}
  </section>
}

// ------------------------------------------------------------------ nuevo traspaso

function NuevoTraspaso({ alEnviar }: { alEnviar: () => void }) {
  const client = useQueryClient()
  const [buscar, setBuscar] = useState('')
  const q = useDeferredValue(buscar.trim())
  const stock = useQuery({ queryKey: ['transfers', 'stock', q], queryFn: () => transfersApi.stock(q || undefined), placeholderData: prev => prev })
  const [origen, setOrigen] = useState<number | null>(null)
  const [destino, setDestino] = useState<number | null>(null)
  const [cantidades, setCantidades] = useState<Record<number, string>>({})
  const [observacion, setObservacion] = useState('')
  const [aviso, setAviso] = useState('')

  const data = stock.data
  const origenes = data?.sucursales.filter(s => data.origenesPermitidos.includes(s.idSucursal)) ?? []
  const idOrigen = origen ?? origenes[0]?.idSucursal ?? null
  const destinos = data?.sucursales.filter(s => s.idSucursal !== idOrigen) ?? []
  const idDestino = destino !== null && destino !== idOrigen ? destino : destinos[0]?.idSucursal ?? null
  const nombreDe = (id: number | null) => data?.sucursales.find(s => s.idSucursal === id)?.nombre ?? ''

  // Las cantidades se guardan aunque cambie la búsqueda; se recuerdan los datos de cada prenda elegida.
  const [elegidas, setElegidas] = useState<Record<number, { prenda: string; disponible: number }>>({})
  const lineas = Object.entries(cantidades)
    .map(([id, c]) => ({ idVariante: Number(id), cantidad: Number(c) }))
    .filter(l => l.cantidad > 0 && elegidas[l.idVariante])
  const excedidas = lineas.filter(l => l.cantidad > elegidas[l.idVariante].disponible)

  const enviar = useMutation({
    mutationFn: () => transfersApi.crear({
      idSucursalOrigen: idOrigen!,
      idSucursalDestino: idDestino!,
      ...(observacion.trim() ? { observacion: observacion.trim() } : {}),
      detalles: lineas.map(({ idVariante, cantidad }) => ({ idVariante, cantidad })),
    }),
    onSuccess: t => {
      setAviso(`Traspaso #${t.idTraspaso} enviado: ${t.unidades} ${t.unidades === 1 ? 'prenda sale' : 'prendas salen'} de ${t.origen.nombre} y quedan en tránsito hasta que ${t.destino.nombre} las reciba.`)
      setCantidades({}); setElegidas({}); setObservacion('')
      void Promise.all([
        client.invalidateQueries({ queryKey: ['transfers'] }),
        client.invalidateQueries({ queryKey: queryKeys.inventory.all }),
      ])
    },
  })

  function cambiarOrigen(id: number) {
    setOrigen(id); setCantidades({}); setElegidas({}); enviar.reset()
  }
  function cambiarCantidad(v: NonNullable<typeof data>['variantes'][number], valor: string) {
    const disponible = v.stock[idOrigen ?? 0] ?? 0
    const n = valor === '' ? '' : String(Math.max(0, Math.min(disponible, Math.floor(Number(valor)))))
    setCantidades(c => ({ ...c, [v.idVariante]: n }))
    setElegidas(e => ({ ...e, [v.idVariante]: { prenda: prenda(v), disponible } }))
    setAviso('')
  }

  if (stock.isLoading) return <div className={dashboardStyles.chartLoading} role="status">Cargando stock por sucursal…</div>
  if (stock.error) return <p className={dashboardStyles.errorNotice} role="alert">{getApiErrorMessage(stock.error)}</p>
  if (!data) return null
  if (data.sucursales.length < 2) return <p className={dashboardStyles.emptyState}>Tu empresa tiene una sola sucursal activa: los traspasos necesitan al menos dos.</p>
  if (!origenes.length) return <p className={dashboardStyles.emptyState}>No tienes una sucursal asignada desde la cual enviar.</p>

  return <div className={styles.stack}>
    {aviso && <p className={styles.notice} role="status">{aviso} <button type="button" className={styles.linkButton} onClick={alEnviar}>Ver en tránsito</button></p>}

    <div className={styles.ruta}>
      <label>Sale de<select value={idOrigen ?? ''} onChange={e => cambiarOrigen(Number(e.target.value))} disabled={origenes.length === 1}>
        {origenes.map(s => <option key={s.idSucursal} value={s.idSucursal}>{s.nombre}</option>)}
      </select></label>
      <ArrowRight className={styles.flecha} size={20} aria-hidden />
      <label>Llega a<select value={idDestino ?? ''} onChange={e => setDestino(Number(e.target.value))}>
        {destinos.map(s => <option key={s.idSucursal} value={s.idSucursal}>{s.nombre}</option>)}
      </select></label>
    </div>

    <article className={dashboardStyles.panel}>
      <div className={dashboardStyles.panelHeader}>
        <div><h2>Stock por sucursal</h2><p>Indica cuántas unidades mover. Solo puedes enviar lo disponible en {nombreDe(idOrigen)}.</p></div>
      </div>
      <label className={dashboardStyles.searchField}><input aria-label="Buscar prenda" placeholder="Buscar por producto o SKU…" value={buscar} onChange={e => setBuscar(e.target.value)} /></label>
      {data.variantes.length ? <div className={dashboardStyles.tableWrap}><table className={`${dashboardStyles.table} ${styles.table}`}>
        <thead><tr>
          <th>Prenda</th>
          {data.sucursales.map(s => <th key={s.idSucursal} className={`${styles.num} ${s.idSucursal === idOrigen ? styles.colOrigen : s.idSucursal === idDestino ? styles.colDestino : ''}`}>{s.nombre}</th>)}
          <th className={styles.num}>Enviar</th>
        </tr></thead>
        <tbody>{data.variantes.map(v => {
          const disponible = v.stock[idOrigen ?? 0] ?? 0
          return <tr key={v.idVariante}>
            <td>{prenda(v)}<br /><small className={styles.sku}>{v.sku}</small></td>
            {data.sucursales.map(s => <td key={s.idSucursal} className={`${styles.num} ${s.idSucursal === idOrigen ? styles.colOrigen : s.idSucursal === idDestino ? styles.colDestino : ''}`}>{v.stock[s.idSucursal] ?? 0}</td>)}
            <td className={styles.num}><input aria-label={`Unidades de ${prenda(v)} a enviar`} type="number" min={0} max={disponible} disabled={!disponible}
              placeholder={disponible ? '0' : '—'} value={cantidades[v.idVariante] ?? ''} onChange={e => cambiarCantidad(v, e.target.value)} /></td>
          </tr>
        })}</tbody>
      </table></div> : <p className={dashboardStyles.emptyState}>No hay prendas que coincidan con “{buscar}”.</p>}
    </article>

    <article className={`${dashboardStyles.panel} ${styles.resumen}`}>
      <h2>Resumen del envío</h2>
      {lineas.length ? <ul className={styles.lista}>{lineas.map(l => <li key={l.idVariante}>
        <span>{elegidas[l.idVariante].prenda}</span><strong>{l.cantidad}</strong>
      </li>)}</ul> : <p className={styles.meta}>Todavía no elegiste prendas.</p>}
      <label>Observación (opcional)<input maxLength={300} value={observacion} onChange={e => setObservacion(e.target.value)} placeholder="Ej. reposición para el fin de semana" /></label>
      {excedidas.length > 0 && <p className={dashboardStyles.errorNotice}>Hay cantidades mayores al stock de origen.</p>}
      {enviar.error && <p className={dashboardStyles.errorNotice} role="alert">{getApiErrorMessage(enviar.error)}</p>}
      <button className="primary-button" type="button" disabled={!lineas.length || !idDestino || !!excedidas.length || enviar.isPending} onClick={() => enviar.mutate()}>
        <Send size={16} /> {enviar.isPending ? 'Enviando…' : `Enviar ${lineas.reduce((s, l) => s + l.cantidad, 0) || ''} a ${nombreDe(idDestino)}`}
      </button>
    </article>
  </div>
}

function prenda(v: { producto: string; talla: string | null; color: string | null }) {
  const extra = [v.talla, v.color].filter(Boolean).join(' / ')
  return extra ? `${v.producto} (${extra})` : v.producto
}

// ------------------------------------------------------------------ en tránsito

function EnTransito() {
  const [aviso, setAviso] = useState('')
  const lista = useQuery({ queryKey: ['transfers', 'lista', 'EN_TRANSITO'], queryFn: () => transfersApi.listar('EN_TRANSITO') })
  if (lista.isLoading) return <div className={dashboardStyles.chartLoading} role="status">Cargando traspasos…</div>
  if (lista.error) return <p className={dashboardStyles.errorNotice} role="alert">{getApiErrorMessage(lista.error)}</p>
  const llegan = lista.data?.filter(t => t.puedeRecibir) ?? []
  const salen = lista.data?.filter(t => !t.puedeRecibir) ?? []
  const avisoEl = aviso && <p className={styles.notice} role="status">{aviso}</p>
  if (!llegan.length && !salen.length) return <div className={styles.stack}>{avisoEl}<p className={dashboardStyles.emptyState}>No hay traspasos en tránsito.</p></div>
  return <div className={styles.stack}>
    {avisoEl}
    {llegan.length > 0 && <h2 className={styles.subtitulo}>Por recibir</h2>}
    {llegan.map(t => <TarjetaTransito key={t.idTraspaso} t={t} alTerminar={setAviso} />)}
    {salen.length > 0 && <h2 className={styles.subtitulo}>Enviados por tus sucursales</h2>}
    {salen.map(t => <TarjetaTransito key={t.idTraspaso} t={t} alTerminar={setAviso} />)}
  </div>
}

function TarjetaTransito({ t, alTerminar }: { t: Traspaso; alTerminar: (mensaje: string) => void }) {
  const client = useQueryClient()
  const [llegaron, setLlegaron] = useState<Record<number, string>>(() => Object.fromEntries(t.detalles.map(d => [d.idDetalleTraspaso, String(d.cantidadEnviada)])))
  const [motivo, setMotivo] = useState('')
  const [cancelando, setCancelando] = useState(false)
  const [motivoCancelacion, setMotivoCancelacion] = useState('')

  const recibidas = t.detalles.map(d => ({ d, n: Math.max(0, Math.min(d.cantidadEnviada, Number(llegaron[d.idDetalleTraspaso] || 0))) }))
  const merma = recibidas.reduce((s, r) => s + r.d.cantidadEnviada - r.n, 0)
  const refrescar = () => Promise.all([
    client.invalidateQueries({ queryKey: ['transfers'] }),
    client.invalidateQueries({ queryKey: queryKeys.inventory.all }),
  ])

  const recibir = useMutation({
    mutationFn: () => transfersApi.recibir(t.idTraspaso, {
      detalles: recibidas.map(r => ({ idDetalleTraspaso: r.d.idDetalleTraspaso, cantidadRecibida: r.n })),
      ...(motivo.trim() ? { observacion: motivo.trim() } : {}),
    }),
    onSuccess: r => {
      const llego = r.unidades - r.merma
      alTerminar(r.estado === 'RECHAZADO'
        ? `Traspaso #${r.idTraspaso} rechazado: las ${r.unidades} unidades quedan registradas como merma.`
        : `Traspaso #${r.idTraspaso} recibido: ${llego} ${llego === 1 ? 'unidad entró' : 'unidades entraron'} al stock de ${r.destino.nombre}${r.merma ? ` y ${r.merma} quedó como merma` : ''}.`)
      void refrescar()
    },
  })
  const cancelar = useMutation({
    mutationFn: () => transfersApi.cancelar(t.idTraspaso, motivoCancelacion.trim() || undefined),
    onSuccess: r => { alTerminar(`Traspaso #${r.idTraspaso} cancelado: las ${r.unidades} unidades volvieron al stock de ${r.origen.nombre}.`); void refrescar() },
  })

  return <article className={`${dashboardStyles.panel} ${styles.tarjeta}`}>
    <header className={styles.tarjetaCabecera}>
      <div>
        <h3>Traspaso #{t.idTraspaso}</h3>
        <p className={styles.meta}><strong>{t.origen.nombre}</strong> <ArrowRight size={14} aria-hidden /> <strong>{t.destino.nombre}</strong> · enviado {fechaHora(t.fechaEnvio)}{t.enviadoPor ? ` por ${t.enviadoPor}` : ''}</p>
        {t.observacion && <p className={styles.meta}>“{t.observacion}”</p>}
      </div>
      <Estado estado={t.estado} />
    </header>

    <div className={dashboardStyles.tableWrap}><table className={`${dashboardStyles.table} ${styles.table}`}>
      <thead><tr><th>Prenda</th><th className={styles.num}>Enviadas</th>{t.puedeRecibir && <><th className={styles.num}>Llegaron bien</th><th className={styles.num}>Merma</th></>}</tr></thead>
      <tbody>{recibidas.map(({ d, n }) => <tr key={d.idDetalleTraspaso}>
        <td>{d.prenda}<br /><small className={styles.sku}>{d.sku}</small></td>
        <td className={styles.num}>{d.cantidadEnviada}</td>
        {t.puedeRecibir && <>
          <td className={styles.num}><input aria-label={`Unidades de ${d.prenda} que llegaron`} type="number" min={0} max={d.cantidadEnviada}
            value={llegaron[d.idDetalleTraspaso] ?? ''} onChange={e => setLlegaron(l => ({ ...l, [d.idDetalleTraspaso]: e.target.value }))} /></td>
          <td className={`${styles.num} ${d.cantidadEnviada - n ? styles.mermaTexto : ''}`}>{d.cantidadEnviada - n}</td>
        </>}
      </tr>)}</tbody>
    </table></div>

    {t.puedeRecibir && <div className={styles.acciones}>
      {merma > 0 && <label>Motivo de la merma ({merma} {merma === 1 ? 'unidad' : 'unidades'})<input required maxLength={300} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej. prenda dañada en el trayecto" /></label>}
      {recibir.error && <p className={dashboardStyles.errorNotice} role="alert">{getApiErrorMessage(recibir.error)}</p>}
      <button className="primary-button" type="button" disabled={recibir.isPending || (merma > 0 && !motivo.trim())} onClick={() => recibir.mutate()}>
        <PackageCheck size={16} /> {recibir.isPending ? 'Registrando…' : merma === t.unidades ? 'Rechazar traspaso' : merma ? 'Recibir con merma' : 'Confirmar recepción'}
      </button>
    </div>}

    {t.puedeCancelar && <div className={styles.cancelar}>
      {!cancelando
        ? <button type="button" className={styles.secundario} onClick={() => setCancelando(true)}>Cancelar envío</button>
        : <>
          <label>Motivo de la cancelación (opcional)<input maxLength={300} value={motivoCancelacion} onChange={e => setMotivoCancelacion(e.target.value)} placeholder="Ej. se envió la talla equivocada" /></label>
          <p className={styles.meta}>Las {t.unidades} unidades vuelven al stock de {t.origen.nombre}.</p>
          {cancelar.error && <p className={dashboardStyles.errorNotice} role="alert">{getApiErrorMessage(cancelar.error)}</p>}
          <div className={styles.botones}>
            <button type="button" className={styles.peligro} disabled={cancelar.isPending} onClick={() => cancelar.mutate()}>{cancelar.isPending ? 'Cancelando…' : 'Confirmar cancelación'}</button>
            <button type="button" className={styles.secundario} onClick={() => setCancelando(false)}>Volver</button>
          </div>
        </>}
    </div>}
  </article>
}

// ------------------------------------------------------------------ historial

function Historial() {
  const [estado, setEstado] = useState<EstadoTraspaso | ''>('')
  const [abierto, setAbierto] = useState<number | null>(null)
  const lista = useQuery({ queryKey: ['transfers', 'lista', estado || 'todos'], queryFn: () => transfersApi.listar(estado || undefined) })
  const totales = useMemo(() => (lista.data ?? []).reduce((s, t) => ({ unidades: s.unidades + t.unidades, merma: s.merma + t.merma }), { unidades: 0, merma: 0 }), [lista.data])

  return <article className={dashboardStyles.panel}>
    <div className={dashboardStyles.panelHeader}>
      <div><h2>Historial</h2><p>{lista.data ? `${lista.data.length} traspasos · ${totales.unidades} unidades enviadas · ${totales.merma} de merma` : 'Últimos 100 traspasos'}</p></div>
      <label className={styles.filtro}>Estado<select value={estado} onChange={e => setEstado(e.target.value as EstadoTraspaso | '')}>
        <option value="">Todos</option>
        {(Object.keys(ESTADOS) as EstadoTraspaso[]).map(e => <option key={e} value={e}>{ESTADOS[e].texto}</option>)}
      </select></label>
    </div>
    {lista.isLoading ? <div className={dashboardStyles.chartLoading} role="status">Cargando…</div>
      : lista.error ? <p className={dashboardStyles.errorNotice} role="alert">{getApiErrorMessage(lista.error)}</p>
      : !lista.data?.length ? <p className={dashboardStyles.emptyState}>No hay traspasos{estado ? ' con ese estado' : ''}.</p>
      : <div className={dashboardStyles.tableWrap}><table className={`${dashboardStyles.table} ${styles.table}`}>
        <thead><tr><th>#</th><th>Enviado</th><th>Ruta</th><th className={styles.num}>Unidades</th><th className={styles.num}>Merma</th><th>Estado</th><th /></tr></thead>
        <tbody>{lista.data.flatMap(t => [
          <tr key={t.idTraspaso}>
            <td>{t.idTraspaso}</td>
            <td className={styles.nowrap}>{fechaHora(t.fechaEnvio)}</td>
            <td>{t.origen.nombre} <ArrowRight size={13} aria-hidden /> {t.destino.nombre}</td>
            <td className={styles.num}>{t.unidades}</td>
            <td className={`${styles.num} ${t.merma ? styles.mermaTexto : ''}`}>{t.merma}</td>
            <td><Estado estado={t.estado} /></td>
            <td><button type="button" className={styles.linkButton} aria-expanded={abierto === t.idTraspaso} onClick={() => setAbierto(abierto === t.idTraspaso ? null : t.idTraspaso)}>{abierto === t.idTraspaso ? 'Ocultar' : 'Detalle'}</button></td>
          </tr>,
          abierto === t.idTraspaso && <tr key={`${t.idTraspaso}-d`} className={styles.detalleFila}><td colSpan={7}>
            <ul className={styles.lista}>{t.detalles.map(d => <li key={d.idDetalleTraspaso}>
              <span>{d.prenda} <small className={styles.sku}>{d.sku}</small></span>
              <strong>{d.cantidadRecibida === null ? `${d.cantidadEnviada} enviadas` : `${d.cantidadRecibida} de ${d.cantidadEnviada}${d.merma ? ` · ${d.merma} de merma` : ''}`}</strong>
            </li>)}</ul>
            <p className={styles.meta}>Enviado por {t.enviadoPor ?? '—'}{t.observacion ? ` · “${t.observacion}”` : ''}</p>
            {t.fechaCierre && <p className={styles.meta}>{t.estado === 'CANCELADO' ? 'Cancelado' : 'Recibido'} {fechaHora(t.fechaCierre)} por {t.cerradoPor ?? '—'}{t.observacionCierre ? ` · “${t.observacionCierre}”` : ''}</p>}
          </td></tr>,
        ])}</tbody>
      </table></div>}
  </article>
}
