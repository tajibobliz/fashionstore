// Una estrategia por tipo de prenda: el componente del vestidor (VestidorVirtual.tsx) no sabe, ni le
// importa, si está mostrando lentes, una gorra o una polera. Cada frame solo hace dos cosas genéricas:
// 1) pide los puntos al detector que le dio esta estrategia (`model`), 2) llama a `placement` con esos
// puntos. Agregar una prenda nueva es agregar una entrada a este mapa, sin tocar el bucle de dibujo.

import { capPlacement, glassesPlacement } from './faceOverlay'
import { shirtPlacement } from './poseOverlay'
import type { Landmark, Placement } from './geometry'
import type { TipoTryOn } from '../../types/catalog'

/** Qué modelo de MediaPipe necesita cada prenda: 'face' (FaceLandmarker) o 'pose' (PoseLandmarker). */
export type TryOnModel = 'face' | 'pose'

export interface TryOnStrategy {
  model: TryOnModel
  placement: (landmarks: readonly Landmark[], width: number, height: number, imageAspect: number, mirrored?: boolean) => Placement | null
  /** Mensaje cuando no se detectan los puntos necesarios (rostro o cuerpo, según `model`). */
  notDetectedHint: string
}

const FACE_HINT = 'No detectamos tu rostro. Mira a la cámara y busca buena luz.'
const POSE_HINT = 'Colócate a 1-2 metros de la cámara para verte de cuerpo entero.'

export const TRY_ON_STRATEGIES: Record<TipoTryOn, TryOnStrategy> = {
  lentes: { model: 'face', placement: glassesPlacement, notDetectedHint: FACE_HINT },
  gorra: { model: 'face', placement: capPlacement, notDetectedHint: FACE_HINT },
  polera: { model: 'pose', placement: shirtPlacement, notDetectedHint: POSE_HINT },
}
