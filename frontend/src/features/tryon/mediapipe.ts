import type { Landmark } from './geometry'
import type { TryOnModel } from './strategies'

// Debe coincidir con la versión de @mediapipe/tasks-vision de package.json: el runtime WASM y la librería
// JS son un par y mezclar versiones falla al inicializar.
const MEDIAPIPE_VERSION = '1.0.1'
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`
const FACE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
// "lite" es la variante más liviana de PoseLandmarker (frente a full/heavy). Alcanza para ubicar hombros
// y caderas en tiempo real en el navegador; full/heavy pesan y tardan más sin aportar nada aquí.
const POSE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

export interface Detector {
  /** Puntos del frame actual (rostro o cuerpo, según el modelo), o null si no detectó nada. */
  detect(video: HTMLVideoElement, timestampMs: number): readonly Landmark[] | null
  close(): void
}

/**
 * Crea el detector de MediaPipe que corresponda: 'face' (FaceLandmarker, para lentes/gorra) o 'pose'
 * (PoseLandmarker, para poleras). Solo se descarga el modelo que hace falta — son archivos separados,
 * así que un producto de lentes nunca paga el costo del modelo de cuerpo, y viceversa.
 * La librería se importa de forma dinámica para que tampoco viaje en el bundle principal de la tienda:
 * solo se descarga al abrir el vestidor. Los .wasm y el modelo .task se piden por URL (CDN), así el
 * despliegue en Vercel no necesita servir esos binarios.
 */
export async function createDetector(model: TryOnModel): Promise<Detector> {
  const { FaceLandmarker, PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL)

  if (model === 'face') {
    const landmarker = await createWithFallback(delegate =>
      FaceLandmarker.createFromOptions(fileset, { baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate }, runningMode: 'VIDEO', numFaces: 1 }),
    )
    return {
      detect: (video, timestampMs) => landmarker.detectForVideo(video, timestampMs).faceLandmarks[0] ?? null,
      close: () => landmarker.close(),
    }
  }

  const landmarker = await createWithFallback(delegate =>
    PoseLandmarker.createFromOptions(fileset, { baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate }, runningMode: 'VIDEO', numPoses: 1 }),
  )
  return {
    detect: (video, timestampMs) => landmarker.detectForVideo(video, timestampMs).landmarks[0] ?? null,
    close: () => landmarker.close(),
  }
}

/** Intenta crear el landmarker con GPU (más rápido); si falla (sin WebGL, drivers problemáticos), reintenta en CPU. */
async function createWithFallback<T>(create: (delegate: 'GPU' | 'CPU') => Promise<T>): Promise<T> {
  try {
    return await create('GPU')
  } catch {
    return await create('CPU')
  }
}
