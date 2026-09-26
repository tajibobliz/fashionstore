// Superposición que usa PoseLandmarker (33 puntos del cuerpo): polera / camiseta.
// A diferencia de lentes y gorra (FaceLandmarker, que solo ve la cara), la polera necesita ver el torso.

import { offsetAlong, screenLine } from './geometry'
import type { Landmark, Placement } from './geometry'

/**
 * Índices de MediaPipe PoseLandmarker (33 puntos del cuerpo). Igual que en la malla facial,
 * "izquierdo/derecho" es desde la perspectiva del propio usuario, no de la imagen.
 */
export const POSE_LANDMARKS = {
  RIGHT_SHOULDER: 12,
  LEFT_SHOULDER: 11,
  RIGHT_HIP: 24,
  LEFT_HIP: 23,
} as const

/** Por debajo de este puntaje de `visibility` (0..1) que da MediaPipe, un punto se considera no confiable. */
export const POSE_MIN_VISIBILITY = 0.5

/** Ancho de la polera respecto a la distancia entre hombros (da holgura para las mangas). */
export const SHIRT_WIDTH_RATIO = 2.2

/** Alto de la polera respecto a la distancia hombros→caderas (incluye cuello y algo de holgura). */
export const SHIRT_HEIGHT_RATIO = 1.7

/** Cuánto sube el borde superior de la polera por encima del punto medio de los hombros, para cubrir el cuello. */
export const SHIRT_NECK_OFFSET_RATIO = 0.35

/**
 * Calcula dónde poner el PNG de la polera a partir de los 4 puntos del torso (hombros y caderas).
 *
 * Devuelve null si falta algún punto o si MediaPipe no está seguro de haberlo visto bien (poca
 * `visibility`): esto pasa, por ejemplo, cuando el usuario está muy cerca de la cámara y las caderas
 * quedan fuera de cuadro. VestidorVirtual usa ese null para pedir "colócate a 1-2 metros de la cámara".
 *
 *  - ESCALA:   ancho = distancia entre hombros; alto = distancia hombros→caderas (da la talla real de la
 *              persona, no un tamaño fijo).
 *  - POSICIÓN: el borde superior de la polera se ancla al punto medio de los hombros y sube un poco
 *              (SHIRT_NECK_OFFSET_RATIO) para que el cuello de la prenda tape la base del cuello real.
 *  - ROTACIÓN: ángulo de la línea entre hombros (se inclina si el usuario gira o ladea el torso).
 */
export function shirtPlacement(
  landmarks: readonly Landmark[],
  width: number,
  height: number,
  imageAspect: number,
  mirrored = true,
): Placement | null {
  const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER]
  const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER]
  const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP]
  const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP]
  const points = [rightShoulder, leftShoulder, rightHip, leftHip]
  if (points.some(point => !point) || !Number.isFinite(imageAspect) || imageAspect <= 0) return null
  if (points.some(point => (point!.visibility ?? 1) < POSE_MIN_VISIBILITY)) return null

  const shoulders = screenLine(rightShoulder, leftShoulder, width, height, mirrored)
  const hips = screenLine(rightHip, leftHip, width, height, mirrored)
  if (shoulders.distance === 0) return null
  const torsoHeight = Math.hypot(hips.midX - shoulders.midX, hips.midY - shoulders.midY)
  if (torsoHeight === 0) return null

  const shirtWidth = shoulders.distance * SHIRT_WIDTH_RATIO
  const shirtHeight = torsoHeight * SHIRT_HEIGHT_RATIO
  // Borde superior: punto medio de los hombros, desplazado hacia arriba (offset negativo) para tapar el cuello.
  const topEdge = offsetAlong(shoulders.midX, shoulders.midY, shoulders.angle, -shoulders.distance * SHIRT_NECK_OFFSET_RATIO)
  // drawPlacement dibuja centrado en (cx, cy): el centro queda medio alto más abajo del borde superior.
  const center = offsetAlong(topEdge.x, topEdge.y, shoulders.angle, shirtHeight / 2)
  return { cx: center.x, cy: center.y, width: shirtWidth, height: shirtHeight, angle: shoulders.angle }
}
