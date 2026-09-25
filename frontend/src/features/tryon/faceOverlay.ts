// Superposiciones que usan FaceLandmarker (los 478 puntos de la malla facial): lentes y gorra.

import { offsetAlong, screenLine, toCanvasPoint } from './geometry'
import type { Landmark, Placement } from './geometry'

/**
 * Índices de la malla de MediaPipe FaceLandmarker (478 puntos: 468 de la cara + 10 del iris).
 * "Derecho/izquierdo" se refiere al usuario, no a la imagen: en el frame SIN espejar el ojo derecho
 * del usuario aparece a la IZQUIERDA de la imagen (misma convención que usa MediaPipe).
 */
export const FACE_LANDMARKS = {
  /** Comisura externa del ojo derecho del usuario (la más alejada de la nariz). */
  RIGHT_EYE_OUTER: 33,
  /** Comisura externa del ojo izquierdo del usuario. */
  LEFT_EYE_OUTER: 263,
  /** Borde superior del rostro / nacimiento del cabello, centro de la frente. Ancla vertical de la gorra. */
  FOREHEAD_TOP: 10,
  /** Punta del mentón. Junto con FOREHEAD_TOP da el "alto de cara" para escalar el offset de la gorra. */
  CHIN: 152,
  /** Lateral del rostro a la altura de la mejilla derecha del usuario (da el ancho de la cabeza). */
  RIGHT_CHEEK: 234,
  /** Lateral del rostro a la altura de la mejilla izquierda del usuario. */
  LEFT_CHEEK: 454,
} as const

// ===== LENTES =====

/**
 * Ancho del marco de los lentes respecto a la distancia entre las comisuras externas de los ojos.
 * En un rostro medio los ojos (33↔263) están a unos 95 mm y un marco de lentes mide ~140-150 mm,
 * de ahí ≈1.55. Es el valor a ajustar si los PNG de los productos vienen con más o menos margen.
 */
export const GLASSES_WIDTH_RATIO = 1.55

/** Desplazamiento vertical del centro de los lentes, como fracción de la distancia entre ojos (+ = hacia abajo). */
export const GLASSES_Y_OFFSET_RATIO = 0.02

/**
 * Calcula dónde poner el PNG de unos lentes.
 *
 * Idea: los dos ojos definen una recta. De esa recta salen las tres magnitudes que necesita un elemento 2D
 * para "pegarse" a la cara:
 *  - POSICIÓN: el punto medio entre los ojos es el puente de la nariz, donde va el centro de los lentes.
 *  - ESCALA:   la distancia entre ojos cambia al acercarse o alejarse de la cámara, así que el ancho de
 *              los lentes es proporcional a ella (GLASSES_WIDTH_RATIO) y "sigue" el rostro en profundidad.
 *  - ROTACIÓN: el ángulo de la recta ojo-ojo es la inclinación lateral de la cabeza (roll); se rota el PNG
 *              ese mismo ángulo para que acompañe la inclinación.
 */
export function glassesPlacement(
  landmarks: readonly Landmark[],
  width: number,
  height: number,
  imageAspect: number,
  mirrored = true,
): Placement | null {
  const right = landmarks[FACE_LANDMARKS.RIGHT_EYE_OUTER]
  const left = landmarks[FACE_LANDMARKS.LEFT_EYE_OUTER]
  if (!right || !left || !Number.isFinite(imageAspect) || imageAspect <= 0) return null

  const eyes = screenLine(right, left, width, height, mirrored)
  if (eyes.distance === 0) return null

  const frameWidth = eyes.distance * GLASSES_WIDTH_RATIO
  // El corrimiento vertical se aplica sobre el eje de la cara (perpendicular a la recta de los ojos),
  // no sobre el eje Y de la pantalla, para que siga siendo correcto con la cabeza inclinada.
  const center = offsetAlong(eyes.midX, eyes.midY, eyes.angle, eyes.distance * GLASSES_Y_OFFSET_RATIO)
  return { cx: center.x, cy: center.y, width: frameWidth, height: frameWidth * imageAspect, angle: eyes.angle }
}

// ===== GORRA =====

/** Ancho de la gorra respecto a la distancia entre mejillas (234↔454: el ancho de la cabeza). */
export const CAP_WIDTH_RATIO = 1.3

/** Cuánto sube el borde inferior de la gorra por encima de la frente (FOREHEAD_TOP), como fracción del alto de cara. */
export const CAP_TOP_OFFSET_RATIO = 0.05

/**
 * Calcula dónde poner el PNG de una gorra o sombrero.
 *
 *  - ESCALA:   el ancho de cabeza (mejilla↔mejilla) escala la gorra, igual que la distancia entre ojos
 *              escala los lentes.
 *  - POSICIÓN: el borde inferior de la gorra se ancla a la frente (punto 10) y sube un 20% del alto de
 *              cara (frente↔mentón) para que la gorra quede calzada sobre la cabeza, no sobre los ojos.
 *  - ROTACIÓN: usa el ángulo de los OJOS, no el de las mejillas — MediaPipe ubica las mejillas con más
 *              ruido de perfil (giros de cabeza), y los ojos dan un ángulo más estable.
 */
export function capPlacement(
  landmarks: readonly Landmark[],
  width: number,
  height: number,
  imageAspect: number,
  mirrored = true,
): Placement | null {
  const rightCheek = landmarks[FACE_LANDMARKS.RIGHT_CHEEK]
  const leftCheek = landmarks[FACE_LANDMARKS.LEFT_CHEEK]
  const forehead = landmarks[FACE_LANDMARKS.FOREHEAD_TOP]
  const chin = landmarks[FACE_LANDMARKS.CHIN]
  const eyeRight = landmarks[FACE_LANDMARKS.RIGHT_EYE_OUTER]
  const eyeLeft = landmarks[FACE_LANDMARKS.LEFT_EYE_OUTER]
  if (!rightCheek || !leftCheek || !forehead || !chin || !eyeRight || !eyeLeft || !Number.isFinite(imageAspect) || imageAspect <= 0) return null

  const head = screenLine(rightCheek, leftCheek, width, height, mirrored) // solo se usa `distance` (ancho de cabeza)
  const eyes = screenLine(eyeRight, eyeLeft, width, height, mirrored) // se usa `angle` (rotación estable)
  const faceHeight = screenLine(forehead, chin, width, height, mirrored).distance
  if (head.distance === 0 || faceHeight === 0) return null

  const capWidth = head.distance * CAP_WIDTH_RATIO
  const capHeight = capWidth * imageAspect
  const foreheadPoint = toCanvasPoint(forehead, width, height, mirrored)
  // Borde inferior de la gorra: la frente desplazada hacia arriba (offset negativo) el % configurado del alto de cara.
  const bottomEdge = offsetAlong(foreheadPoint.x, foreheadPoint.y, eyes.angle, -faceHeight * CAP_TOP_OFFSET_RATIO)
  // drawPlacement dibuja centrado en (cx, cy): el centro queda medio alto más arriba todavía del borde inferior.
  const center = offsetAlong(bottomEdge.x, bottomEdge.y, eyes.angle, -capHeight / 2)
  return { cx: center.x, cy: center.y, width: capWidth, height: capHeight, angle: eyes.angle }
}
