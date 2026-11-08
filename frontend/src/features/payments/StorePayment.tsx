import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Banknote, CheckCircle2, CreditCard, Landmark, QrCode, Truck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { paymentsApi, fileToBase64 } from '../../api/payments.api'
import { salesApi } from '../../api/sales.api'
import { queryKeys } from '../../api/queryKeys'
import type { MetodoPago, MetodosTienda, Pago } from '../../types/payment'
import type { Venta } from '../../types/sale'
import { getApiErrorMessage } from '../../utils/apiError'
import { formatMoney } from '../../utils/money'
import { NOMBRE_METODO, nombreMetodo } from './metodos'
import styles from './Payments.module.css'

const MAX_COMPROBANTE = 3 * 1024 * 1024
const TIPOS_COMPROBANTE = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']

interface OpcionPago { metodo: MetodoPago; detalle: string; icono: LucideIcon; activo: (m: MetodosTienda) => boolean }
const OPCIONES: OpcionPago[] = [
  { metodo: 'TARJETA', detalle: 'Pagas en la página segura de la pasarela y vuelves aquí.', icono: CreditCard, activo: m => m.tarjeta },
  { metodo: 'QR', detalle: 'Escanea el QR de la tienda con tu app del banco y sube el comprobante.', icono: QrCode, activo: m => m.qr },
  { metodo: 'TRANSFERENCIA', detalle: 'Transfiere a la cuenta de la tienda y sube el comprobante.', icono: Landmark, activo: m => m.transferencia },
  { metodo: 'EFECTIVO', detalle: 'Pagas en la sucursal cuando recoges tu pedido.', icono: Banknote, activo: m => m.efectivoRetiro },
  { metodo: 'CONTRAPAGO', detalle: 'Pagas en efectivo cuando recibes tu pedido.', icono: Truck, activo: m => m.contraentrega },
]

/**
 * Pantalla de pago de la clienta para una compra de la tienda online (P2c).
 * Muestra solo los medios que su tienda activó, en la moneda de la tienda:
 * - Tarjeta → redirige a Stripe Checkout (o a la pasarela simulada) y vuelve a /t/:slug/compra/:id.
 * - QR / transferencia → registra el pago PENDIENTE y pide el comprobante; el personal lo verifica.
 * - Efectivo al retirar / contra entrega → registra el pago PENDIENTE; se cobra al entregar.
 */
export default function StorePayment({ sale, aviso }: { sale: Venta; aviso?: string }) {
  const client = useQueryClient()
  const metodos = useQuery({ queryKey: ['payments', 'metodos'], queryFn: paymentsApi.methods })
  const pagos = useQuery({ queryKey: queryKeys.payments.bySale(sale.idVenta), queryFn: () => paymentsApi.bySale(sale.idVenta) })
  const [elegido, setElegido] = useState<MetodoPago | null>(null)
  const [cambiando, setCambiando] = useState(false)
  const [error, setError] = useState('')
  // Pedido hecho sin conexión (CU16): cambios locales tras aceptar el total o cancelar.
  const [decision, setDecision] = useState<'aceptado' | 'cancelado' | null>(null)

  const refrescar = () => Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.payments.bySale(sale.idVenta) }),
    client.invalidateQueries({ queryKey: queryKeys.sales.mine }),
    client.invalidateQueries({ queryKey: ['sales', 'detalle', sale.idVenta] }),
  ])

  const registrar = useMutation({
    mutationFn: async (metodo: MetodoPago) => {
      if (metodo === 'TARJETA') {
        const { url } = await paymentsApi.payWithCard(sale.idVenta)
        window.location.assign(url)
        return null
      }
      return paymentsApi.create({ idVenta: sale.idVenta, metodo, monto: Number(sale.total), clientRequestId: crypto.randomUUID() })
    },
    onSuccess: async pago => { if (pago) { setCambiando(false); setError(''); await refrescar() } },
    onError: e => setError(getApiErrorMessage(e)),
  })

  const decidir = useMutation({
    mutationFn: (d: 'aceptado' | 'cancelado') => d === 'aceptado' ? salesApi.acceptTotal(sale.idVenta) : salesApi.cancel(sale.idVenta),
    onSuccess: async (_, d) => { setDecision(d); setError(''); await refrescar() },
    onError: e => setError(getApiErrorMessage(e)),
  })

  const m = metodos.data
  const lista = pagos.data ?? []
  const pendiente = sale.estado === 'PENDIENTE' && decision !== 'cancelado'
  const vence = sale.pagoDiferido && sale.pagoVenceEn ? new Date(sale.pagoVenceEn) : null
  const venceTexto = vence?.toLocaleString('es-BO', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  const precioPorAceptar = pendiente && sale.pagoDiferido && decision !== 'aceptado' &&
    sale.totalEstimado != null && Number(sale.totalEstimado) !== Number(sale.total)
  const aprobado = sale.estado === 'PAGADA' || lista.some(p => p.estado === 'APROBADO')
  // El pago "en curso" es el último pendiente que no sea de tarjeta (la tarjeta se resuelve en la pasarela).
  const enCurso = [...lista].reverse().find(p => p.estado === 'PENDIENTE' && p.metodo !== 'TARJETA') ?? null
  const rechazado = !enCurso && [...lista].reverse().find(p => p.estado === 'RECHAZADO')

  const resumen = <article className={styles.resumen}>
    <h2>Pedido {sale.numeroComprobante ?? `#${sale.idVenta}`}</h2>
    {sale.sucursal?.nombre && <p>Retiro en {sale.sucursal.nombre}</p>}
    <div>{sale.detalles?.map(d => <div className={styles.linea} key={d.idDetalleVenta ?? d.variante?.idVariante}>
      <span>{d.cantidad} × {d.variante?.producto?.nombre ?? d.variante?.sku ?? 'Prenda'}<small>{[d.variante?.talla?.nombre, d.variante?.color?.nombre].filter(Boolean).join(' · ')}</small></span>
      <span>{formatMoney(d.subtotal, m?.moneda)}</span>
    </div>)}</div>
    <div className={styles.total}><span>Total</span><strong>{formatMoney(sale.total ?? 0, m?.moneda)}</strong></div>
    {sale.pagoDiferido && <p className={styles.ayuda}>Pedido hecho sin conexión{pendiente && venceTexto ? ` · págalo antes del ${venceTexto}; si no, se cancela solo` : ''}.</p>}
  </article>

  let panel
  if (metodos.isLoading || pagos.isLoading) panel = <p role="status">Cargando medios de pago…</p>
  else if (metodos.error || !m) panel = <p className={styles.error} role="alert">{getApiErrorMessage(metodos.error)}</p>
  else if (aprobado) panel = <p className={styles.notice} role="status"><CheckCircle2 size={16} style={{ verticalAlign: 'text-bottom' }} /> ¡Pago confirmado! Tu pedido está pagado y la tienda ya lo está preparando.</p>
  else if (!pendiente) panel = <p className={styles.error}>Este pedido fue cancelado{sale.pagoDiferido && decision !== 'cancelado' ? ' porque venció el plazo para pagarlo' : ''}.</p>
  else if (precioPorAceptar) panel = <div className={styles.stack}>
    <p className={styles.warning}>El precio cambió mientras estabas sin conexión. Total que viste: <strong>{formatMoney(sale.totalEstimado, m.moneda)}</strong>; total actual: <strong>{formatMoney(sale.total ?? 0, m.moneda)}</strong>.</p>
    <p>Para pagar debes aceptar el nuevo total. Si no te conviene, puedes cancelar el pedido.</p>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <button className="primary-button" disabled={decidir.isPending} onClick={() => decidir.mutate('aceptado')}>Aceptar {formatMoney(sale.total ?? 0, m.moneda)}</button>
    <button className="logout-button" disabled={decidir.isPending} onClick={() => decidir.mutate('cancelado')}>Cancelar pedido</button>
  </div>
  else if (enCurso && !cambiando) panel = <PagoEnCurso pago={enCurso} metodos={m} sucursal={sale.sucursal?.nombre} alCambiar={() => { setCambiando(true); setElegido(null) }} alSubir={refrescar} />
  else {
    const opciones = OPCIONES.filter(o => o.activo(m))
    const actual = elegido ?? opciones[0]?.metodo ?? null
    panel = <div className={styles.stack}>
      {rechazado && <p className={styles.warning}>Tu pago anterior por {nombreMetodo(rechazado.metodo).toLowerCase()} no fue aprobado. Elige un medio para intentarlo de nuevo.</p>}
      <fieldset className={styles.metodos}>
        <legend>¿Cómo quieres pagar?</legend>
        {opciones.map(({ metodo, detalle, icono: Icono }) =>
          <label key={metodo} className={`${styles.metodo} ${actual === metodo ? styles.metodoActivo : ''}`}>
            <input type="radio" name="metodo" checked={actual === metodo} onChange={() => setElegido(metodo)} />
            <Icono size={20} />
            <span><strong>{NOMBRE_METODO[metodo]}</strong><small>{detalle}{metodo === 'TARJETA' && m.proveedorTarjeta === 'SIMULADO' ? ' (modo de prueba)' : ''}</small></span>
          </label>)}
      </fieldset>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button className="primary-button" disabled={!actual || registrar.isPending} onClick={() => actual && registrar.mutate(actual)}>
        {registrar.isPending ? 'Procesando…' : actual === 'TARJETA' ? `Pagar ${formatMoney(sale.total ?? 0, m.moneda)} con tarjeta` : 'Continuar'}
      </button>
      {cambiando && <button className="logout-button" onClick={() => setCambiando(false)}>Volver</button>}
    </div>
  }

  return <section className={styles.pagina}>
    <h1>{aprobado ? 'Pago confirmado' : 'Pagar mi compra'}</h1>
    {aviso && <p className={styles.warning} role="status">{aviso}</p>}
    <div className={styles.columnas}>
      {resumen}
      <aside className={styles.panel}>{panel}</aside>
    </div>
  </section>
}

/** Pago ya elegido y pendiente: instrucciones del medio y, si aplica, subir el comprobante. */
function PagoEnCurso({ pago, metodos, sucursal, alCambiar, alSubir }: { pago: Pago; metodos: MetodosTienda; sucursal?: string; alCambiar: () => void; alSubir: () => Promise<unknown> }) {
  const conComprobante = pago.metodo === 'QR' || pago.metodo === 'TRANSFERENCIA'
  const qr = useQuery({ queryKey: ['payments', 'qr'], queryFn: paymentsApi.qrDataUrl, enabled: pago.metodo === 'QR', staleTime: 60_000 })
  const qrUrl = qr.data
  const [archivo, setArchivo] = useState<File | null>(null)
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)
  const monto = formatMoney(pago.monto, metodos.moneda)

  const subir = useMutation({
    mutationFn: async (f: File) => paymentsApi.uploadReceipt(pago.idPago, await fileToBase64(f), f.type, f.name),
    onSuccess: async () => { setMensaje({ ok: true, texto: 'Comprobante enviado. La tienda lo revisará y confirmará tu pago; verás el cambio en "Mis compras".' }); setArchivo(null); await alSubir() },
    onError: e => setMensaje({ ok: false, texto: getApiErrorMessage(e) }),
  })
  function elegir(f: File | undefined) {
    setMensaje(null)
    if (!f) return setArchivo(null)
    if (!TIPOS_COMPROBANTE.includes(f.type)) return setMensaje({ ok: false, texto: 'Sube una imagen (PNG, JPG, WebP) o un PDF.' })
    if (f.size > MAX_COMPROBANTE) return setMensaje({ ok: false, texto: 'El archivo supera los 3 MB.' })
    setArchivo(f)
  }

  return <div className={styles.stack}>
    <div className={styles.instrucciones}>
      <h3>{nombreMetodo(pago.metodo)} · {monto}</h3>
      {pago.metodo === 'QR' && <>
        <p>Escanea este QR con la app de tu banco y paga exactamente <strong>{monto}</strong>.</p>
        {qrUrl ? <img className={styles.qr} src={qrUrl} alt="QR de pago de la tienda" /> : <p role="status">Cargando QR…</p>}
      </>}
      {pago.metodo === 'TRANSFERENCIA' && metodos.cuenta && <>
        <p>Transfiere exactamente <strong>{monto}</strong> a esta cuenta:</p>
        <dl className={styles.cuenta}>
          <dt>Banco</dt><dd>{metodos.cuenta.banco}</dd>
          <dt>Titular</dt><dd>{metodos.cuenta.titular}</dd>
          <dt>N.º de cuenta</dt><dd>{metodos.cuenta.numeroCuenta}</dd>
          {metodos.cuenta.tipoCuenta && <><dt>Tipo</dt><dd>{metodos.cuenta.tipoCuenta}</dd></>}
          {metodos.cuenta.documentoTitular && <><dt>CI / NIT</dt><dd>{metodos.cuenta.documentoTitular}</dd></>}
        </dl>
      </>}
      {pago.metodo === 'EFECTIVO' && <p>Tu pedido queda reservado. Paga <strong>{monto}</strong> en efectivo al retirarlo{sucursal ? <> en <strong>{sucursal}</strong></> : ''}.</p>}
      {pago.metodo === 'CONTRAPAGO' && <p>Paga <strong>{monto}</strong> en efectivo a quien te entregue el pedido.</p>}
      {metodos.instrucciones && <p className={styles.ayuda}>{metodos.instrucciones}</p>}
    </div>

    {conComprobante && <label className={styles.subir}>
      Comprobante de pago
      <input type="file" accept={TIPOS_COMPROBANTE.join(',')} onChange={e => elegir(e.target.files?.[0])} />
      <span className={styles.ayuda}>Captura o PDF del comprobante, hasta 3 MB. Si te equivocaste, puedes volver a subirlo.</span>
    </label>}
    {mensaje && <p className={mensaje.ok ? styles.notice : styles.error} role={mensaje.ok ? 'status' : 'alert'}>{mensaje.texto}</p>}
    {conComprobante && <button className="primary-button" disabled={!archivo || subir.isPending} onClick={() => archivo && subir.mutate(archivo)}>{subir.isPending ? 'Enviando…' : 'Enviar comprobante'}</button>}
    {!conComprobante && <p className={styles.notice}>Listo: la tienda registrará tu pago cuando lo cobre.</p>}
    <button className={styles.linkButton} onClick={alCambiar}>Elegir otro medio de pago</button>
  </div>
}
