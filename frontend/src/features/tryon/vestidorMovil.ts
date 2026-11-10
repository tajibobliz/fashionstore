/**
 * Vestidor virtual para la APP MÓVIL. Corre dentro de un WebView y usa exactamente la misma lógica
 * que el vestidor web (estrategias por tipo de prenda, colocación y suavizado), así los dos se ven igual.
 *
 * No forma parte del bundle de la tienda: `mobile/scripts/generar-vestidor.mjs` lo empaqueta con Vite
 * como un script suelto (IIFE) y lo guarda dentro de la app (vestidorWeb.generated.ts). La librería de
 * MediaPipe se trae del CDN (misma versión que la web), igual que el runtime WASM y los modelos.
 *
 * La página avisa a la app con `window.ReactNativeWebView.postMessage(JSON)`:
 *   { tipo: 'fase', fase: 'camara' | 'modelo' | 'listo' }
 *   { tipo: 'detectado', valor: boolean }
 *   { tipo: 'error', error: 'image' | 'denied' | 'no-camera' | 'camera' | 'model', detalle?: string }
 *   { tipo: 'foto', dataUrl }   (respuesta a window.vestidor.foto())
 */
import { createDetectorWith, MEDIAPIPE_VERSION, type Detector } from './mediapipe'
import { TRY_ON_STRATEGIES } from './strategies'
import { drawPlacement, smoothPlacement, type Placement } from './geometry'
import type { TipoTryOn } from '../../types/catalog'

const LIB_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/vision_bundle.mjs`
const MAX_MISSED_FRAMES = 6
const FALLBACK_IMAGE_ASPECT = 0.4

interface Config {
  tipo: TipoTryOn
  imagen: string
}

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage(mensaje: string): void }
    vestidor?: { foto(): void }
  }
}

const avisar = (mensaje: Record<string, unknown>) => window.ReactNativeWebView?.postMessage(JSON.stringify(mensaje))

function cargarImagen(url: string) {
  return new Promise<{ image: HTMLImageElement; exportable: boolean }>((resolve, reject) => {
    const probar = (anonimo: boolean) => {
      const image = new Image()
      if (anonimo) image.crossOrigin = 'anonymous'
      image.onload = () => resolve({ image, exportable: anonimo })
      image.onerror = () => (anonimo ? probar(false) : reject(new Error('imagen')))
      image.src = url
    }
    probar(!url.startsWith('data:'))
  })
}

/** Rechaza la promesa si no termina a tiempo (para no quedarse cargando sin fin). */
function conLimite<T>(promesa: Promise<T>, ms: number, motivo: string) {
  return new Promise<T>((resolve, reject) => {
    const reloj = setTimeout(() => reject(new Error(motivo)), ms)
    promesa.then(
      (valor) => (clearTimeout(reloj), resolve(valor)),
      (error) => (clearTimeout(reloj), reject(error)),
    )
  })
}

/** Espera a que el video tenga imagen (readyState >= 2 y tamaño conocido). */
function primerCuadro(video: HTMLVideoElement) {
  return new Promise<void>((resolve) => {
    const revisar = () => (video.readyState >= 2 && video.videoWidth ? resolve() : setTimeout(revisar, 100))
    revisar()
  })
}

function tipoDeError(causa: unknown) {
  const nombre = (causa as { name?: string })?.name
  if (nombre === 'NotAllowedError' || nombre === 'SecurityError') return 'denied'
  if (nombre === 'NotFoundError' || nombre === 'OverconstrainedError') return 'no-camera'
  return 'camera'
}

export async function iniciar({ tipo, imagen }: Config) {
  const video = document.getElementById('video') as HTMLVideoElement
  const canvas = document.getElementById('lienzo') as HTMLCanvasElement
  const ctx = canvas.getContext('2d')!
  const strategyType = tipo === 'gorra' ? 'GORRA' : tipo === 'polera' ? 'TOP' : tipo
  const estrategia = TRY_ON_STRATEGIES[strategyType]
  let exportable = false

  // 1) PNG sin fondo de la prenda.
  let prenda: HTMLImageElement
  try {
    const cargada = await cargarImagen(imagen)
    prenda = cargada.image
    exportable = cargada.exportable || imagen.startsWith('data:')
  } catch {
    return avisar({ tipo: 'error', error: 'image' })
  }
  const aspecto = prenda.naturalHeight / prenda.naturalWidth || FALLBACK_IMAGE_ASPECT

  // 2) Cámara frontal. En el WebView de Android getUserMedia o play() pueden quedarse "colgados" sin
  //    error, así que cada paso tiene tiempo límite y se avisa el motivo en lugar de cargar para siempre.
  avisar({ tipo: 'fase', fase: 'camara' })
  if (!navigator.mediaDevices?.getUserMedia) return avisar({ tipo: 'error', error: 'camera', detalle: 'getUserMedia no disponible' })
  try {
    const stream = await conLimite(
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }),
      15000,
      'la cámara no respondió',
    )
    video.muted = true
    video.setAttribute('playsinline', '')
    video.setAttribute('autoplay', '')
    video.srcObject = stream
    // play() puede no resolverse nunca en Android: basta con que llegue el primer cuadro de video.
    video.play().catch(() => {})
    await conLimite(primerCuadro(video), 10000, 'el video de la cámara no arrancó')
  } catch (causa) {
    return avisar({ tipo: 'error', error: tipoDeError(causa), detalle: String((causa as Error)?.message ?? causa) })
  }

  // 3) Modelo de MediaPipe (rostro o cuerpo según la prenda).
  avisar({ tipo: 'fase', fase: 'modelo' })
  let detector: Detector
  try {
    detector = await conLimite(
      import(/* @vite-ignore */ LIB_URL).then((lib) => createDetectorWith(lib, estrategia.model)),
      60000,
      'el detector tardó demasiado en descargarse',
    )
  } catch (causa) {
    return avisar({ tipo: 'error', error: 'model', detalle: String((causa as Error)?.message ?? causa) })
  }
  avisar({ tipo: 'fase', fase: 'listo' })

  // 4) Bucle de dibujo (igual al de VestidorVirtual.tsx): video en espejo y el PNG encima.
  let ultimoTiempo = -1
  let colocacion: Placement | null = null
  let perdidos = 0
  let detectado = true
  const dibujar = () => {
    requestAnimationFrame(dibujar)
    if (video.readyState < 2 || !video.videoWidth) return
    const ancho = video.videoWidth
    const alto = video.videoHeight
    if (canvas.width !== ancho || canvas.height !== alto) {
      canvas.width = ancho
      canvas.height = alto
    }
    ctx.save()
    ctx.translate(ancho, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, ancho, alto)
    ctx.restore()
    if (video.currentTime !== ultimoTiempo) {
      ultimoTiempo = video.currentTime
      try {
        const puntos = detector.detect(video, performance.now())
        const objetivo = puntos ? estrategia.placement(puntos, ancho, alto, aspecto) : null
        if (objetivo) {
          colocacion = smoothPlacement(colocacion, objetivo)
          perdidos = 0
        } else if (++perdidos > MAX_MISSED_FRAMES) {
          colocacion = null
        }
      } catch {
        return avisar({ tipo: 'error', error: 'model' })
      }
      const visible = colocacion !== null
      if (visible !== detectado) {
        detectado = visible
        avisar({ tipo: 'detectado', valor: visible })
      }
    }
    if (colocacion) drawPlacement(ctx, prenda, colocacion)
  }
  dibujar()

  // Foto: solo si la imagen permite exportarse (CORS); si no, el canvas queda "manchado".
  window.vestidor = {
    foto() {
      if (!exportable) return avisar({ tipo: 'foto', error: 'cors' })
      try {
        avisar({ tipo: 'foto', dataUrl: canvas.toDataURL('image/jpeg', 0.9) })
      } catch {
        avisar({ tipo: 'foto', error: 'cors' })
      }
    },
  }
}
