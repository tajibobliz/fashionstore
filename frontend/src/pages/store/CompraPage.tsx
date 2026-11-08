import { useEffect, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react'
import { Brand } from '../../components/common/Brand'
import { salesApi } from '../../api/sales.api'
import { paymentsApi } from '../../api/payments.api'
import { queryKeys } from '../../api/queryKeys'
import { useAuth } from '../../hooks/useAuth'
import { useStore } from '../../features/store/storeContext'
import StorePayment from '../../features/payments/StorePayment'
import { getApiErrorMessage } from '../../utils/apiError'
import { formatMoney } from '../../utils/money'
import styles from '../../features/payments/Payments.module.css'

/**
 * /t/:slug/compra/:idVenta — página de una compra de la tienda online.
 * Es la URL de vuelta de la pasarela de tarjeta:
 * - ?ref=…        Stripe cobró: esperamos el aviso (webhook) que confirma la venta.
 * - ?cancelado=1  la clienta volvió sin pagar: puede elegir otro medio.
 * - ?simulado=ID  pasarela de prueba (sin claves de Stripe): formulario de tarjeta ficticio.
 * Sin parámetros muestra el estado de la compra y la pantalla de pago.
 */
export default function CompraPage() {
  const { idVenta: param } = useParams()
  const idVenta = Number(param)
  const [params, setParams] = useSearchParams()
  const { isAuthenticated } = useAuth()
  const { base } = useStore()
  const ref = params.get('ref')
  const simulado = Number(params.get('simulado')) || null
  // Con ?ref se consulta cada 2 s hasta que el webhook confirme (máx. 1 min).
  const [tarde, setTarde] = useState(false)
  useEffect(() => { if (!ref) return; const t = setTimeout(() => setTarde(true), 60_000); return () => clearTimeout(t) }, [ref])
  const esperando = !!ref && !tarde
  const venta = useQuery({
    queryKey: ['sales', 'detalle', idVenta],
    queryFn: () => salesApi.get(idVenta),
    enabled: isAuthenticated && Number.isInteger(idVenta),
    refetchInterval: q => esperando && q.state.data?.estado !== 'PAGADA' ? 2000 : false,
  })

  if (!isAuthenticated) return <Navigate to={`${base}/login?redirect=${encodeURIComponent(`${base}/compra/${param}${params.size ? `?${params}` : ''}`)}`} replace />

  const header = <header className="workspace-header"><Brand /><div className="workspace-user"><Link className="cart-link" to={`${base}/tienda`}><ArrowLeft size={17} /> Volver a la tienda</Link></div></header>
  let contenido
  if (venta.isLoading) contenido = <div className="empty-state" role="status">Cargando tu compra…</div>
  else if (venta.error || !venta.data) contenido = <div className="empty-state" role="alert"><h2>No pudimos abrir esta compra</h2><p>{getApiErrorMessage(venta.error)}</p></div>
  else if (simulado && venta.data.estado !== 'PAGADA') contenido = <TarjetaSimulada idPago={simulado} total={venta.data.total ?? 0} alTerminar={() => setParams({}, { replace: true })} />
  else if (ref && venta.data.estado !== 'PAGADA' && esperando) contenido = <section className="cart-page"><div className="empty-state" role="status"><Loader2 className={styles.spin} size={30} /><h2>Confirmando tu pago…</h2><p>La pasarela ya recibió tu pago. Estamos esperando su confirmación; tarda unos segundos.</p></div></section>
  else contenido = <StorePayment
    sale={venta.data}
    aviso={params.get('cancelado') ? 'No se completó el pago con tarjeta. Puedes intentarlo de nuevo o elegir otro medio.'
      : ref && venta.data.estado !== 'PAGADA' ? 'Aún no recibimos la confirmación de la pasarela. Si ya pagaste, revisa "Mis compras" en unos minutos; si el pago no se completa, el dinero se devuelve.' : undefined}
  />
  return <div className="workspace">{header}<main className="workspace-main">{contenido}</main></div>
}

/**
 * Pasarela de prueba: se usa cuando el sistema no tiene claves de Stripe (desarrollo o demo).
 * No se ingresan datos reales; "Pagar" aprueba el pago en el backend como lo haría el webhook.
 */
function TarjetaSimulada({ idPago, total, alTerminar }: { idPago: number; total: number | string; alTerminar: () => void }) {
  const client = useQueryClient()
  const pagar = useMutation({
    mutationFn: () => paymentsApi.paySimulated(idPago),
    onSuccess: async () => {
      await Promise.all([client.invalidateQueries({ queryKey: ['sales'] }), client.invalidateQueries({ queryKey: queryKeys.sales.mine }), client.invalidateQueries({ queryKey: ['payments'] })])
      alTerminar()
    },
  })
  return <section className={styles.pagina}>
    <h1>Pasarela de pago (prueba)</h1>
    <div className={styles.stack} style={{ maxWidth: 420 }}>
      <p className={styles.warning}><ShieldCheck size={16} style={{ verticalAlign: 'text-bottom' }} /> Modo de prueba: no se cobra dinero real. En producción esta pantalla es la página segura de Stripe.</p>
      <div className={styles.tarjetaSim} aria-label="Tarjeta de prueba">
        <label>Número de tarjeta<input readOnly value="4242 4242 4242 4242" /></label>
        <div className={styles.fila}>
          <label>Vence<input readOnly value="12/34" /></label>
          <label>CVC<input readOnly value="123" /></label>
        </div>
      </div>
      {pagar.error && <p className={styles.error} role="alert">{getApiErrorMessage(pagar.error)}</p>}
      <button className="primary-button" disabled={pagar.isPending} onClick={() => pagar.mutate()}>{pagar.isPending ? 'Procesando…' : `Pagar ${formatMoney(total)}`}</button>
      <button className="logout-button" disabled={pagar.isPending} onClick={() => alTerminar()}>Cancelar</button>
    </div>
  </section>
}
