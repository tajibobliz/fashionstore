import type { FaceLandmarker } from '@mediapipe/tasks-vision'

// Debe coincidir con la versión de @mediapipe/tasks-vision de package.json: el runtime WASM y la librería
// JS son un par y mezclar versiones falla al inicializar.
const MEDIAPIPE_VERSION = '1.0.1'
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

/**
 * Crea el detector de rostros. La librería se importa de forma dinámica para que no viaje en el bundle
 * principal de la tienda: solo se descarga al abrir el vestidor. Vite la separa en su propio chunk.
 * Los .wasm y el modelo .task se piden por URL (CDN), así el repositorio y el despliegue en Vercel
 * no necesitan servir esos binarios.
 */
export async function createFaceLandmarker(): Promise<FaceLandmarker> {
  const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL)
  const create = (delegate: 'GPU' | 'CPU') =>
    FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: 'VIDEO',
      numFaces: 1,
    })
  try {
    return await create('GPU')
  } catch {
    // Sin WebGL (o con drivers problemáticos) se cae a CPU: más lento pero funcional.
    return await create('CPU')
  }
}
