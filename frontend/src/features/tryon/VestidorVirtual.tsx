import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { ArrowLeft, Camera, RefreshCw } from 'lucide-react'
import { catalogApi } from '../../api/catalog.api'
import { queryKeys } from '../../api/queryKeys'
import { getApiErrorMessage } from '../../utils/apiError'
import type { TipoTryOn } from '../../types/catalog'
import { createDetector } from './mediapipe'
import type { Detector } from './mediapipe'
import { drawPlacement, smoothPlacement } from './geometry'
import type { Placement } from './geometry'
import { TRY_ON_STRATEGIES } from './strategies'
import styles from './VestidorVirtual.module.css'

// Frames consecutivos sin rostro que se toleran antes de quitar el PNG (evita parpadeos por una detección fallida).
const MAX_MISSED_FRAMES = 6
// Relación alto/ancho de respaldo si el navegador no informa el tamaño del PNG (p. ej. un SVG sin dimensiones).
const FALLBACK_IMAGE_ASPECT = 0.4

type StageError = 'unsupported' | 'denied' | 'no-camera' | 'busy' | 'camera' | 'image' | 'model'

const ERROR_COPY: Record<StageError, { title: string; text: string; retry: boolean }> = {
  unsupported: {
    title: 'Navegador no compatible',
    text: 'Tu navegador no permite acceder a la cámara. Usa una versión reciente de Chrome, Edge, Firefox o Safari y abre el sitio con conexión segura (HTTPS).',
    retry: false,
  },
  denied: {
    title: 'Necesitamos permiso de cámara para funcionar',
    text: 'El acceso a la cámara está bloqueado. Haz clic en el candado (o el ícono de cámara) junto a la dirección del sitio, permite el uso de la cámara y pulsa Reintentar.',
    retry: true,
  },
  'no-camera': {
    title: 'Tu dispositivo no tiene cámara',
    text: 'No detectamos ninguna cámara. Conecta una webcam o prueba desde otro dispositivo.',
    retry: true,
  },
  busy: {
    title: 'No pudimos usar la cámara',
    text: 'Otra aplicación o pestaña la está usando. Ciérrala y pulsa Reintentar.',
    retry: true,
  },
  camera: { title: 'No pudimos iniciar la cámara', text: 'Ocurrió un problema inesperado al iniciar la cámara.', retry: true },
  image: {
    title: 'No pudimos cargar la imagen del producto',
    text: 'La imagen para el vestidor virtual no está disponible. Inténtalo de nuevo en unos minutos.',
    retry: true,
  },
  model: {
    title: 'No se pudo cargar el detector facial',
    text: 'Revisa tu conexión a internet e inténtalo de nuevo.',
    retry: true,
  },
}

export default function VestidorVirtual() {
  const { productoId } = useParams()
  const navigate = useNavigate()
  const [attempt, setAttempt] = useState(0)
  const id = Number(productoId)
  const validId = Number.isInteger(id) && id > 0
  const product = useQuery({
    queryKey: [...queryKeys.catalog.products, id],
    queryFn: () => catalogApi.products.get(id),
    enabled: validId,
    retry: false,
  })
  // La ficha del producto es estado interno de /tienda; se le indica cuál reabrir al volver.
  const backToProduct = () => navigate('/tienda', { state: { productoId: id } })
  const backToStore = () => navigate('/tienda')

  let content: ReactNode
  if (!validId || (product.isError && axios.isAxiosError(product.error) && product.error.response?.status === 404)) {
    content = <Notice title="No encontramos este producto" text="Puede que ya no esté disponible.">
      <button type="button" className={`primary-button ${styles.action}`} onClick={backToStore}><ArrowLeft size={18} aria-hidden="true" />Volver a la tienda</button>
    </Notice>
  } else if (product.isPending) {
    content = <Notice title="Cargando producto…" />
  } else if (product.isError) {
    content = <Notice title="No se pudo cargar el producto" text={getApiErrorMessage(product.error)}>
      <button type="button" className={`primary-button ${styles.action}`} onClick={() => void product.refetch()}><RefreshCw size={18} aria-hidden="true" />Reintentar</button>
      <button type="button" className={styles.secondary} onClick={backToStore}>Volver a la tienda</button>
    </Notice>
  } else if (!product.data.imagenTryOn || !product.data.tipoTryOn) {
    content = <Notice title="Este producto aún no tiene vestidor virtual" text="Todavía no cargamos la imagen necesaria para probártelo.">
      <button type="button" className={`primary-button ${styles.action}`} onClick={backToProduct}><ArrowLeft size={18} aria-hidden="true" />Volver al producto</button>
    </Notice>
  } else {
    // `key` reinicia por completo la cámara y el modelo cuando el usuario pulsa Reintentar.
    content = <TryOnStage key={attempt} tryOnUrl={product.data.imagenTryOn} tipoTryOn={product.data.tipoTryOn} productName={product.data.nombre} onBack={backToProduct} onRetry={() => setAttempt(value => value + 1)} />
  }

  return <main className={styles.page}>
    <header className={styles.header}>
      <p className={styles.kicker}>Vestidor virtual</p>
      <h1 className={styles.title}>{product.data?.nombre ?? 'Pruébatelo en casa'}</h1>
    </header>
    {content}
  </main>
}

function Notice({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  return <section className={styles.notice} role="status">
    <h2>{title}</h2>
    {text && <p>{text}</p>}
    {children && <div className={styles.noticeActions}>{children}</div>}
  </section>
}

interface StageProps {
  tryOnUrl: string
  tipoTryOn: TipoTryOn
  productName: string
  onBack: () => void
  onRetry: () => void
}

function TryOnStage({ tryOnUrl, tipoTryOn, productName, onBack, onRetry }: StageProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // false si el servidor de la imagen no envía CORS: se ve bien, pero el canvas queda "tainted" y no se puede exportar.
  const exportable = useRef(true)
  const supported = useMemo(() => Boolean(navigator.mediaDevices?.getUserMedia), [])
  // La estrategia decide QUÉ modelo cargar (cara o cuerpo) y CÓMO ubicar el PNG; el resto de este
  // componente es el mismo sea cual sea la prenda.
  const strategy = TRY_ON_STRATEGIES[tipoTryOn]
  const [phase, setPhase] = useState<'starting' | 'model' | 'ready'>('starting')
  const [error, setError] = useState<StageError | null>(null)
  const [detected, setDetected] = useState(true)
  const [notice, setNotice] = useState('')
  const shownError: StageError | null = supported ? error : 'unsupported'

  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!supported || !video || !canvas || !ctx) return

    let cancelled = false
    let frame = 0
    let stream: MediaStream | null = null
    let detector: Detector | null = null

    const stopAll = () => {
      cancelAnimationFrame(frame)
      stream?.getTracks().forEach(track => track.stop())
      stream = null
      detector?.close()
      detector = null
    }
    const fail = (kind: StageError) => {
      if (cancelled) return
      stopAll()
      setError(kind)
    }

    const run = async () => {
      // 1) Imagen del producto (PNG sin fondo).
      let tryOn: Awaited<ReturnType<typeof loadTryOnImage>>
      try {
        tryOn = await loadTryOnImage(tryOnUrl)
      } catch {
        return fail('image')
      }
      if (cancelled) return
      exportable.current = tryOn.exportable
      const imageAspect = tryOn.image.naturalHeight / tryOn.image.naturalWidth || FALLBACK_IMAGE_ASPECT

      // 2) Cámara frontal. `ideal` 1280x720: se pide HD sin exigirlo, y así también funciona en cámaras más simples.
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
      } catch (cause) {
        return fail(cameraErrorKind(cause))
      }
      if (cancelled) return stopAll()
      video.srcObject = stream
      try {
        await video.play()
      } catch {
        return fail('camera')
      }
      if (cancelled) return
      setPhase('model')

      // 3) Modelo de MediaPipe: FaceLandmarker (lentes/gorra) o PoseLandmarker (poleras), según la estrategia.
      try {
        detector = await createDetector(strategy.model)
      } catch {
        return fail('model')
      }
      if (cancelled) return stopAll()
      setPhase('ready')

      // 4) Bucle de dibujo: cada frame pinta el video y, encima, el PNG siguiendo el rostro o el cuerpo.
      const activeDetector = detector
      let lastVideoTime = -1
      let placement: Placement | null = null
      let missed = 0
      let wasDetected = true
      const draw = () => {
        frame = requestAnimationFrame(draw)
        if (video.readyState < 2 || !video.videoWidth) return
        const width = video.videoWidth
        const height = video.videoHeight
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width
          canvas.height = height
        }
        // Vista tipo espejo (selfie): el video se dibuja invertido en horizontal.
        ctx.save()
        ctx.translate(width, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(video, 0, 0, width, height)
        ctx.restore()

        // Solo se detecta cuando llega un frame nuevo de la cámara (el canvas puede repintar más rápido).
        if (video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime
          try {
            const landmarks = activeDetector.detect(video, performance.now())
            const target = landmarks ? strategy.placement(landmarks, width, height, imageAspect) : null
            if (target) {
              placement = smoothPlacement(placement, target)
              missed = 0
            } else if (++missed > MAX_MISSED_FRAMES) {
              placement = null
            }
          } catch {
            return fail('model')
          }
          const visible = placement !== null
          if (visible !== wasDetected) {
            wasDetected = visible
            setDetected(visible)
          }
        }
        // El PNG va SIN espejar (el texto y logos se leen bien); solo su posición está espejada.
        if (placement) drawPlacement(ctx, tryOn.image, placement)
      }
      draw()
    }
    void run()

    return () => {
      cancelled = true
      stopAll()
      video.srcObject = null
    }
  }, [supported, tryOnUrl, strategy])

  const takePhoto = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const flash = (message: string) => {
      setNotice(message)
      window.setTimeout(() => setNotice(''), 3500)
    }
    try {
      canvas.toBlob(blob => {
        if (!blob) return flash('No se pudo generar la foto.')
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `vestidor-${slugify(productName)}.png`
        link.click()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
        flash('Foto descargada.')
      }, 'image/png')
    } catch {
      // El canvas quedó "tainted" porque el servidor del PNG no permite CORS.
      flash(exportable.current ? 'No se pudo generar la foto.' : 'No se puede descargar la foto: el sitio de la imagen no permite exportarla.')
    }
  }

  const copy = shownError ? ERROR_COPY[shownError] : null
  return <>
    <div className={styles.stage}>
      {/* El <video> solo alimenta al canvas: no se muestra (y no usa display:none para que el navegador siga decodificándolo). */}
      <video ref={videoRef} className={styles.video} playsInline muted aria-hidden="true" />
      {copy && <Notice title={copy.title} text={copy.text}>
        {copy.retry && <button type="button" className={`primary-button ${styles.action}`} onClick={onRetry}><RefreshCw size={18} aria-hidden="true" />Reintentar</button>}
      </Notice>}
      {!copy && phase !== 'ready' && <div className={styles.placeholder} role="status">
        <span className={styles.spinner} aria-hidden="true" />
        {phase === 'starting' ? 'Iniciando cámara…' : 'Cargando el detector…'}
      </div>}
      <div className={`${styles.canvasWrap} ${!copy && phase === 'ready' ? '' : styles.hidden}`}>
        <canvas ref={canvasRef} className={styles.canvas} aria-label={`Tu imagen con ${productName} superpuesto`} />
        {!detected && <p className={styles.hint} role="status">{strategy.notDetectedHint}</p>}
      </div>
    </div>
    <div className={styles.controls}>
      <button type="button" className={`primary-button ${styles.action}`} onClick={takePhoto} disabled={phase !== 'ready' || Boolean(copy)}>
        <Camera size={18} aria-hidden="true" />Tomar foto
      </button>
      <button type="button" className={styles.secondary} onClick={onBack}><ArrowLeft size={18} aria-hidden="true" />Volver al producto</button>
      {notice && <span className={styles.note} role="status">{notice}</span>}
    </div>
  </>
}

// Intenta cargar la imagen con CORS (permite exportar el canvas para la foto); si el servidor no lo envía,
// la carga sin CORS: se ve igual, pero no se podrá descargar la foto.
async function loadTryOnImage(url: string) {
  try {
    return { image: await loadImage(url, true), exportable: true }
  } catch {
    return { image: await loadImage(url, false), exportable: false }
  }
}

function loadImage(url: string, anonymous: boolean) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    if (anonymous) image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('No se pudo cargar la imagen'))
    image.src = url
  })
}

// Traduce el error de getUserMedia a un caso que el usuario pueda entender y resolver.
function cameraErrorKind(cause: unknown): StageError {
  const name = cause instanceof DOMException ? cause.name : ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') return 'denied'
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') return 'no-camera'
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') return 'busy'
  return 'camera'
}

function slugify(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'producto'
}
