import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { paymentsApi } from '../../api/payments.api'
import type { EstadoPago, PagoPorVerificar } from '../../types/payment'
import { queryKeys } from '../../api/queryKeys'
import { getApiErrorMessage } from '../../utils/apiError'
import { nombreMetodo } from './metodos'
import dashboardStyles from '../dashboard/Dashboard.module.css'
import styles from './Payments.module.css'

const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

/**
 * Pagos de la tienda online por verificar (personal). QR y transferencia se aprueban tras
 * revisar el comprobante; efectivo y contra entrega, al cobrar. Aprobar confirma la venta
 * y descuenta el stock; rechazar deja la compra pendiente para que la clienta pague de otra forma.
 */
export default function PaymentsToVerifyPage() {
  const client = useQueryClient()
  const lista = useQuery({ queryKey: ['payments', 'por-verificar'], queryFn: paymentsApi.toVerify, refetchInterval: 30_000 })
  const [viendo, setViendo] = useState<PagoPorVerificar | null>(null)
  const [confirmar, setConfirmar] = useState<{ pago: PagoPorVerificar; estado: EstadoPago } | null>(null)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)

  const decidir = useMutation({
    mutationFn: ({ pago, estado }: { pago: PagoPorVerificar; estado: EstadoPago }) => paymentsApi.updateStatus(pago.idPago, estado),
    onSuccess: (_, { pago, estado }) => {
      setAviso({ ok: true, texto: estado === 'APROBADO' ? `Pago de ${pago.montoTexto} aprobado: la venta ${pago.venta.comprobante ?? `#${pago.venta.idVenta}`} quedó pagada y se descontó el stock.` : `Pago rechazado. La clienta podrá pagar ${pago.venta.comprobante ?? `la venta #${pago.venta.idVenta}`} con otro medio.` })
      setConfirmar(null); setViendo(null)
      void Promise.all([client.invalidateQueries({ queryKey: ['payments'] }), client.invalidateQueries({ queryKey: queryKeys.inventory.all })])
    },
    onError: e => { setAviso({ ok: false, texto: getApiErrorMessage(e) }); setConfirmar(null) },
  })

  const filas = lista.data ?? []
  return <section className={dashboardStyles.content}>
    <div className={dashboardStyles.pageHeading}><div>
      <p className={dashboardStyles.kicker}>Tienda online</p>
      <h1>Pagos por verificar</h1>
      <p>Revisa los comprobantes de QR y transferencia, y registra los cobros en efectivo de los pedidos online.</p>
    </div></div>

    {aviso && <p className={aviso.ok ? styles.notice : styles.error} role={aviso.ok ? 'status' : 'alert'} style={{ marginBottom: 16 }}>{aviso.texto}</p>}
    {lista.isLoading ? <div className={dashboardStyles.chartLoading} role="status">Cargando pagos…</div>
      : lista.error ? <p className={dashboardStyles.errorNotice} role="alert">{getApiErrorMessage(lista.error)}</p>
      : !filas.length ? <p className={dashboardStyles.emptyState}>No hay pagos pendientes. Cuando una clienta pague por QR o transferencia aparecerá aquí.</p>
      : <div className={dashboardStyles.tableWrap}><table className={dashboardStyles.table}>
        <thead><tr><th>Fecha</th><th>Clienta</th><th>Pedido</th><th>Medio</th><th className={styles.num}>Monto</th><th>Comprobante</th><th>Acción</th></tr></thead>
        <tbody>{filas.map(p => {
          const conComprobante = p.metodo === 'QR' || p.metodo === 'TRANSFERENCIA'
          return <tr key={p.idPago}>
            <td className={styles.num}>{fechaHora(p.fecha)}</td>
            <td>{p.cliente?.nombre ?? '—'}<span className={styles.sub}>{p.cliente?.email}</span></td>
            <td>{p.venta.comprobante ?? `#${p.venta.idVenta}`}<span className={styles.sub}>{p.venta.sucursal}</span></td>
            <td><span className={`${styles.metodoTag} ${styles[`tag${p.metodo}`] ?? ''}`}>{nombreMetodo(p.metodo)}</span></td>
            <td className={styles.num}><strong>{p.montoTexto}</strong></td>
            <td>{!conComprobante ? <span className={styles.sub}>Se cobra al entregar</span> : p.comprobante ? <button className={styles.ver} onClick={() => setViendo(p)}>Ver comprobante</button> : <span className={styles.sinComprobante}>Aún no lo sube</span>}</td>
            <td><div className={styles.botones}>
              <button className={styles.aprobar} disabled={decidir.isPending || (conComprobante && !p.comprobante)} onClick={() => setConfirmar({ pago: p, estado: 'APROBADO' })}>{conComprobante ? 'Aprobar' : 'Cobrado'}</button>
              <button className={styles.rechazar} disabled={decidir.isPending} onClick={() => setConfirmar({ pago: p, estado: 'RECHAZADO' })}>Rechazar</button>
            </div></td>
          </tr>
        })}</tbody>
      </table></div>}

    {viendo && <VisorComprobante pago={viendo} cerrar={() => setViendo(null)} decidir={estado => setConfirmar({ pago: viendo, estado })} />}

    {confirmar && <div className={dashboardStyles.modalBackdrop} role="dialog" aria-modal="true">
      <section className="confirmDialog">
        <h2>{confirmar.estado === 'APROBADO' ? 'Aprobar pago' : 'Rechazar pago'}</h2>
        <p>{confirmar.estado === 'APROBADO'
          ? `Confirmas que recibiste ${confirmar.pago.montoTexto}. La venta quedará pagada y se descontará el stock.`
          : 'El comprobante no corresponde o el dinero no llegó. La compra sigue pendiente y la clienta podrá pagar de nuevo.'}</p>
        <div className={dashboardStyles.modalActions}>
          <button onClick={() => setConfirmar(null)}>Volver</button>
          <button className={confirmar.estado === 'APROBADO' ? 'primary-button' : dashboardStyles.dangerButton} disabled={decidir.isPending} onClick={() => decidir.mutate(confirmar)}>{decidir.isPending ? 'Guardando…' : confirmar.estado === 'APROBADO' ? 'Aprobar' : 'Rechazar'}</button>
        </div>
      </section>
    </div>}
  </section>
}

function VisorComprobante({ pago, cerrar, decidir }: { pago: PagoPorVerificar; cerrar: () => void; decidir: (e: EstadoPago) => void }) {
  const esPdf = pago.comprobante?.mime === 'application/pdf'
  // Las imágenes se muestran aquí mismo; el PDF se abre en otra pestaña con el visor del navegador.
  const archivo = useQuery({ queryKey: ['payments', 'comprobante', pago.idPago, pago.comprobante?.subidoEn], queryFn: () => paymentsApi.receiptBlob(pago.idPago) })
  const imagen = useQuery({ queryKey: ['payments', 'comprobante-img', pago.idPago, pago.comprobante?.subidoEn], queryFn: () => paymentsApi.fileToDataUrl(archivo.data!), enabled: !!archivo.data && !esPdf })
  function abrirPdf() {
    if (!archivo.data) return
    const url = URL.createObjectURL(archivo.data)
    window.open(url, '_blank', 'noopener')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
  return <div className={dashboardStyles.modalBackdrop} role="dialog" aria-modal="true" onClick={cerrar}>
    <section className={`confirmDialog ${styles.visor}`} onClick={e => e.stopPropagation()}>
      <h2>Comprobante · {pago.montoTexto}</h2>
      <p>{pago.cliente?.nombre} · {nombreMetodo(pago.metodo)} · {pago.venta.comprobante ?? `#${pago.venta.idVenta}`}</p>
      {archivo.error ? <p className={styles.error} role="alert">{getApiErrorMessage(archivo.error)}</p>
        : !archivo.data ? <p role="status">Cargando comprobante…</p>
        : esPdf ? <p><button className={styles.ver} onClick={abrirPdf}>Abrir el PDF en otra pestaña</button></p>
        : imagen.data ? <img src={imagen.data} alt="Comprobante de pago" /> : <p role="status">Cargando comprobante…</p>}
      <div className={dashboardStyles.modalActions}>
        <button onClick={cerrar}>Cerrar</button>
        <button className={dashboardStyles.dangerButton} onClick={() => decidir('RECHAZADO')}>Rechazar</button>
        <button className="primary-button" onClick={() => decidir('APROBADO')}>Aprobar</button>
      </div>
    </section>
  </div>
}
