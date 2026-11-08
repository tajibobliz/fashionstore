import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { tenantApi } from '../../api/tenant.api'
import { getApiErrorMessage } from '../../utils/apiError'
import dashboardStyles from '../dashboard/Dashboard.module.css'
import payStyles from '../payments/Payments.module.css'
import styles from './PortadaTienda.module.css'

const LEMA_DEFECTO = 'Descubre lo nuevo de la temporada, elige tu talla y color, y compra online o reserva para retirar en tu sucursal favorita.'

/**
 * Portada de la tienda online (ADMIN). La imagen se guarda como ENLACE (https), no como archivo:
 * así se conserva en la base de datos al desplegar (el disco del servidor se borra en cada despliegue).
 */
export default function PortadaTiendaPage() {
  const client = useQueryClient()
  const me = useQuery({ queryKey: ['tenant', 'me'], queryFn: tenantApi.me })
  const [cambios, setCambios] = useState<{ portadaUrl?: string; eslogan?: string }>({})
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [fallaImagen, setFallaImagen] = useState('')

  const guardar = useMutation({
    mutationFn: (body: { portadaUrl?: string | null; eslogan?: string | null }) => tenantApi.cambiarPortada(body),
    onSuccess: async () => {
      setCambios({}); setAviso({ ok: true, texto: 'Portada guardada. Tus clientas ya la ven en la página de inicio de tu tienda.' })
      await Promise.all([client.invalidateQueries({ queryKey: ['tenant', 'me'] }), client.invalidateQueries({ queryKey: ['saas', 'tienda'] })])
    },
    onError: e => setAviso({ ok: false, texto: getApiErrorMessage(e) }),
  })

  if (me.isLoading) return <div className={dashboardStyles.chartLoading} role="status">Cargando…</div>
  if (me.error || !me.data) return <p className={dashboardStyles.errorNotice} role="alert">{getApiErrorMessage(me.error)}</p>
  const empresa = me.data.empresa
  const portadaUrl = cambios.portadaUrl ?? empresa.portadaUrl ?? ''
  const eslogan = cambios.eslogan ?? empresa.eslogan ?? ''
  const urlValida = /^https:\/\/\S+$/i.test(portadaUrl.trim())
  const hayCambios = Object.keys(cambios).length > 0
  const cambiar = (c: typeof cambios) => { setCambios(x => ({ ...x, ...c })); setAviso(null) }

  return <section className={dashboardStyles.content}>
    <div className={dashboardStyles.pageHeading}><div>
      <p className={dashboardStyles.kicker}>Tienda online</p>
      <h1>Portada de la tienda</h1>
      <p>La imagen grande y la frase que ven tus clientas al entrar a tu tienda. Sin imagen se muestra un mosaico con tus prendas.</p>
    </div></div>

    <div className={payStyles.grid}>
      <div className={payStyles.card}>
        <h2>Imagen y frase</h2>
        <div className={payStyles.campos}>
          <label className={payStyles.campoAncho}>Imagen de portada (enlace)
            <input value={portadaUrl} onChange={e => cambiar({ portadaUrl: e.target.value })} placeholder="https://…/portada.jpg" maxLength={500} inputMode="url" autoComplete="off" />
            <small className={payStyles.ayuda}>Pega el enlace de una foto (debe empezar con https://). Vertical u horizontal: se recorta para llenar el espacio.</small>
          </label>
          <label className={payStyles.campoAncho}>Frase de la portada
            <textarea rows={3} maxLength={160} value={eslogan} onChange={e => cambiar({ eslogan: e.target.value })} placeholder={LEMA_DEFECTO} />
            <small className={payStyles.ayuda}>{eslogan.length}/160 · vacía = se usa el texto de ejemplo.</small>
          </label>
        </div>
        {portadaUrl.trim() && !urlValida && <p className={payStyles.warning}>El enlace debe empezar con https://</p>}
      </div>

      <div className={payStyles.card}>
        <h2>Vista previa</h2>
        <div className={styles.preview}>
          <div className={styles.previewText}>
            <strong>Tu estilo, <em>a tu manera</em>, en {empresa.nombre}</strong>
            <span>{eslogan.trim() || LEMA_DEFECTO}</span>
          </div>
          <div className={styles.previewImg}>
            {urlValida && fallaImagen !== portadaUrl
              ? <img src={portadaUrl.trim()} alt="Portada de la tienda" onError={() => setFallaImagen(portadaUrl)} />
              : <span>{urlValida ? 'No se pudo cargar la imagen' : 'Mosaico de prendas'}</span>}
          </div>
        </div>
        <Link to={`/t/${empresa.slug}`} target="_blank" className={payStyles.linkButton}>Ver mi tienda <ExternalLink size={13} aria-hidden="true" /></Link>
      </div>
    </div>

    {aviso && <p className={aviso.ok ? payStyles.notice : payStyles.error} role={aviso.ok ? 'status' : 'alert'} style={{ marginTop: 16 }}>{aviso.texto}</p>}
    <div className={payStyles.acciones} style={{ marginTop: 16 }}>
      <button className="primary-button" disabled={!hayCambios || guardar.isPending || (!!portadaUrl.trim() && !urlValida)} onClick={() => guardar.mutate({ portadaUrl: portadaUrl.trim() || null, eslogan: eslogan.trim() || null })}>{guardar.isPending ? 'Guardando…' : 'Guardar portada'}</button>
      {hayCambios && <button className="logout-button" onClick={() => { setCambios({}); setAviso(null) }}>Descartar</button>}
      {!hayCambios && empresa.portadaUrl && <button className="logout-button" disabled={guardar.isPending} onClick={() => guardar.mutate({ portadaUrl: null })}>Quitar imagen</button>}
    </div>
  </section>
}
