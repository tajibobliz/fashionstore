import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Upload } from 'lucide-react'
import { paymentsApi, fileToBase64 } from '../../api/payments.api'
import type { ConfigPagoTienda } from '../../types/payment'
import { getApiErrorMessage } from '../../utils/apiError'
import dashboardStyles from '../dashboard/Dashboard.module.css'
import styles from './Payments.module.css'

type Medio = 'tarjeta' | 'qr' | 'transferencia' | 'efectivoRetiro' | 'contraentrega'
type Texto = 'banco' | 'titular' | 'numeroCuenta' | 'tipoCuenta' | 'documentoTitular' | 'instrucciones'
const MEDIOS: { id: Medio; titulo: string; detalle: string }[] = [
  { id: 'tarjeta', titulo: 'Tarjeta de débito o crédito', detalle: 'Cobro en línea con Stripe, en la moneda de tu tienda.' },
  { id: 'qr', titulo: 'QR', detalle: 'La clienta escanea tu QR y sube el comprobante.' },
  { id: 'transferencia', titulo: 'Transferencia bancaria', detalle: 'La clienta transfiere a tu cuenta y sube el comprobante.' },
  { id: 'efectivoRetiro', titulo: 'Efectivo al retirar', detalle: 'Se cobra en la sucursal al entregar el pedido.' },
  { id: 'contraentrega', titulo: 'Contra entrega', detalle: 'Se cobra en efectivo al entregar a domicilio.' },
]
const CAMPOS: { id: Texto; etiqueta: string; ancho?: boolean }[] = [
  { id: 'banco', etiqueta: 'Banco' }, { id: 'titular', etiqueta: 'Titular' }, { id: 'numeroCuenta', etiqueta: 'N.º de cuenta' },
  { id: 'tipoCuenta', etiqueta: 'Tipo de cuenta' }, { id: 'documentoTitular', etiqueta: 'CI / NIT del titular' },
]
const MAX_QR = 600 * 1024

/**
 * Medios de pago de la tienda online (ADMIN, todos los planes). Activa los medios que acepta,
 * sube su QR y los datos de su cuenta. Las clientas solo ven los medios activos.
 */
export default function PaymentSettingsPage() {
  const client = useQueryClient()
  const config = useQuery({ queryKey: ['payments', 'config'], queryFn: paymentsApi.config })
  const qr = useQuery({ queryKey: ['payments', 'qr', config.data?.actualizadoEn ?? ''], queryFn: paymentsApi.qrDataUrl, enabled: !!config.data?.qrSubido, retry: false })
  const qrUrl = qr.data
  // Cambios sin guardar sobre lo que vino del servidor.
  const [cambios, setCambios] = useState<Partial<ConfigPagoTienda>>({})
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)

  const guardar = useMutation({
    mutationFn: () => paymentsApi.saveConfig(cambios),
    onSuccess: data => { client.setQueryData(['payments', 'config'], data); setCambios({}); setAviso({ ok: true, texto: 'Medios de pago guardados. Tus clientas ya ven estos cambios.' }) },
    onError: e => setAviso({ ok: false, texto: getApiErrorMessage(e) }),
  })
  const subirQr = useMutation({
    mutationFn: async (f: File) => paymentsApi.uploadQr(await fileToBase64(f), f.type),
    onSuccess: data => { client.setQueryData(['payments', 'config'], data); setAviso({ ok: true, texto: 'QR actualizado.' }) },
    onError: e => setAviso({ ok: false, texto: getApiErrorMessage(e) }),
  })

  const quitarQr = useMutation({
    mutationFn: paymentsApi.removeQr,
    onSuccess: data => { client.setQueryData(['payments', 'config'], data); setCambios(x => Object.fromEntries(Object.entries(x).filter(([k]) => k !== 'qr'))); setAviso({ ok: true, texto: 'QR quitado: el pago por QR quedó desactivado.' }) },
    onError: e => setAviso({ ok: false, texto: getApiErrorMessage(e) }),
  })

  if (config.isLoading) return <div className={dashboardStyles.chartLoading} role="status">Cargando medios de pago…</div>
  if (config.error || !config.data) return <p className={dashboardStyles.errorNotice} role="alert">{getApiErrorMessage(config.error)}</p>
  const v = { ...config.data, ...cambios }
  const cambiar = (c: Partial<ConfigPagoTienda>) => { setCambios(x => ({ ...x, ...c })); setAviso(null) }
  function elegirQr(f: File | undefined) {
    if (!f) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(f.type)) return setAviso({ ok: false, texto: 'El QR debe ser una imagen PNG, JPG o WebP.' })
    if (f.size > MAX_QR) return setAviso({ ok: false, texto: 'La imagen del QR supera los 600 KB.' })
    subirQr.mutate(f)
  }

  return <section className={dashboardStyles.content}>
    <div className={dashboardStyles.pageHeading}><div>
      <p className={dashboardStyles.kicker}>Tienda online</p>
      <h1>Medios de pago</h1>
      <p>Elige cómo te pagan tus clientas en la tienda online. Disponible en todos los planes.</p>
    </div></div>

    <div className={styles.grid}>
      <div className={styles.card}>
        <h2>Medios aceptados</h2>
        {MEDIOS.map(m => <label key={m.id} className={styles.switch}>
          <input type="checkbox" checked={!!v[m.id]} onChange={e => cambiar({ [m.id]: e.target.checked })} />
          <span><strong>{m.titulo} {m.id === 'tarjeta' && <span className={styles.badge}>{v.proveedorTarjeta === 'STRIPE' ? 'Stripe' : 'Modo prueba'}</span>}</strong><small>{m.detalle}</small></span>
        </label>)}
      </div>

      <div className={styles.card}>
        <h2>QR de cobro</h2>
        <p>Sube el QR que te da tu banco. Se muestra a la clienta junto al monto de su compra.</p>
        <div className={styles.qrPreview}>
          {qrUrl ? <img src={qrUrl} alt="QR de la tienda" /> : <div className={styles.qrVacio}>{config.data.qrSubido ? 'Cargando…' : 'Sin QR'}</div>}
          <label className="logout-button" style={{ cursor: 'pointer' }}>
            <Upload size={15} style={{ verticalAlign: 'text-bottom' }} /> {subirQr.isPending ? 'Subiendo…' : config.data.qrSubido ? 'Reemplazar QR' : 'Subir QR'}
            <input type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={subirQr.isPending} onChange={e => { elegirQr(e.target.files?.[0]); e.target.value = '' }} />
          </label>
          {config.data.qrSubido && <button type="button" className={styles.linkButton} disabled={quitarQr.isPending} onClick={() => quitarQr.mutate()}>Quitar QR</button>}
        </div>
      </div>

      <div className={styles.card}>
        <h2>Cuenta para transferencias</h2>
        <div className={styles.campos}>
          {CAMPOS.map(c => <label key={c.id}>{c.etiqueta}<input value={v[c.id] ?? ''} onChange={e => cambiar({ [c.id]: e.target.value })} maxLength={c.id === 'documentoTitular' ? 30 : c.id === 'numeroCuenta' || c.id === 'tipoCuenta' ? 40 : 120} /></label>)}
          <label className={styles.campoAncho}>Indicaciones para la clienta (opcional)<textarea rows={2} maxLength={300} value={v.instrucciones ?? ''} onChange={e => cambiar({ instrucciones: e.target.value })} placeholder="Ej.: indica tu número de pedido en la glosa." /></label>
        </div>
      </div>
    </div>

    {aviso && <p className={aviso.ok ? styles.notice : styles.error} role={aviso.ok ? 'status' : 'alert'} style={{ marginTop: 16 }}>{aviso.texto}</p>}
    <div className={styles.acciones} style={{ marginTop: 16 }}>
      <button className="primary-button" disabled={!Object.keys(cambios).length || guardar.isPending} onClick={() => guardar.mutate()}>{guardar.isPending ? 'Guardando…' : 'Guardar cambios'}</button>
      {Object.keys(cambios).length > 0 && <button className="logout-button" onClick={() => { setCambios({}); setAviso(null) }}>Descartar</button>}
    </div>
  </section>
}
