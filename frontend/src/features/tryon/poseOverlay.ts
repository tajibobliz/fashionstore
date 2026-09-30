// Superposición que usa PoseLandmarker (33 puntos del cuerpo): polera / camiseta.
// A diferencia de lentes y gorra (FaceLandmarker, que solo ve la cara), la polera necesita ver el torso.

import { fitAspect, offsetAlong, screenLine, toCanvasPoint } from './geometry'
import type { Landmark, Placement } from './geometry'

/**
 * Índices de MediaPipe PoseLandmarker (33 puntos del cuerpo). Igual que en la malla facial,
 * "izquierdo/derecho" es desde la perspectiva del propio usuario, no de la imagen.
 */
export const POSE_LANDMARKS = {
  NOSE: 0,
  MOUTH_RIGHT: 10,
  MOUTH_LEFT: 9,
  RIGHT_SHOULDER: 12,
  LEFT_SHOULDER: 11,
  RIGHT_WRIST: 16,
  LEFT_WRIST: 15,
  RIGHT_HIP: 24,
  LEFT_HIP: 23,
  RIGHT_KNEE: 26,
  LEFT_KNEE: 25,
  RIGHT_ANKLE: 28,
  LEFT_ANKLE: 27,
} as const

/** Por debajo de este puntaje de `visibility` (0..1) que da MediaPipe, un punto se considera no confiable. */
export const POSE_MIN_VISIBILITY = 0.5

/** Ancho de la polera respecto a la distancia entre hombros (da holgura para las mangas). */
export const SHIRT_WIDTH_RATIO = 2.2

/** Alto de la polera respecto a la distancia hombros→caderas (incluye cuello y algo de holgura). */
export const SHIRT_HEIGHT_RATIO = 1.7

/** Cuánto sube el borde superior de la polera por encima del punto medio de los hombros, para cubrir el cuello. */
export const SHIRT_NECK_OFFSET_RATIO = 0.35

/** Elevación visual adicional respecto al alto final de la prenda, sin modificar su escala. */
export const SHIRT_VERTICAL_RAISE_RATIO = 0.08

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
  const center = offsetAlong(topEdge.x, topEdge.y, shoulders.angle, shirtHeight * (0.5 - SHIRT_VERTICAL_RAISE_RATIO))
  return { cx: center.x, cy: center.y, width: shirtWidth, height: shirtHeight, angle: shoulders.angle }
}

function validPosePoints(points: Array<Landmark | undefined>, imageAspect: number): points is Landmark[] {
  return Number.isFinite(imageAspect)
    && imageAspect > 0
    && points.every(point => Boolean(point) && (point!.visibility ?? 1) >= POSE_MIN_VISIBILITY)
}

export function dressPlacement(
  landmarks: readonly Landmark[],
  width: number,
  height: number,
  imageAspect: number,
  mirrored = true,
): Placement | null {
  const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER]
  const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER]
  const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP]
  const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP]
  const leftKnee = landmarks[POSE_LANDMARKS.LEFT_KNEE]
  const rightKnee = landmarks[POSE_LANDMARKS.RIGHT_KNEE]
  if (!validPosePoints([leftShoulder, rightShoulder, leftHip, rightHip, leftKnee, rightKnee], imageAspect)) return null

  const shoulders = screenLine(leftShoulder, rightShoulder, width, height, mirrored)
  const hips = screenLine(leftHip, rightHip, width, height, mirrored)
  const knees = screenLine(leftKnee, rightKnee, width, height, mirrored)
  const baseDressHeight = Math.hypot(knees.midX - shoulders.midX, knees.midY - shoulders.midY)
  const baseDressWidth = Math.max(shoulders.distance, hips.distance, knees.distance) * 1.10
  const baseSize = fitAspect(baseDressWidth, baseDressHeight, imageAspect)
  if (!baseSize) return null
  const dressWidth = baseSize.width * 4.025
  const dressHeight = baseSize.height * 4.025
  const center = offsetAlong(shoulders.midX, shoulders.midY, shoulders.angle, dressHeight / 2)
  return { cx: center.x, cy: center.y, width: dressWidth, height: dressHeight, angle: shoulders.angle }
}

export function skirtPlacement(
  landmarks: readonly Landmark[],
  width: number,
  height: number,
  imageAspect: number,
  mirrored = true,
): Placement | null {
  const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP]
  const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP]
  const leftKnee = landmarks[POSE_LANDMARKS.LEFT_KNEE]
  const rightKnee = landmarks[POSE_LANDMARKS.RIGHT_KNEE]
  if (!validPosePoints([leftHip, rightHip, leftKnee, rightKnee], imageAspect)) return null

  const hips = screenLine(leftHip, rightHip, width, height, mirrored)
  const knees = screenLine(leftKnee, rightKnee, width, height, mirrored)
  const regionHeight = Math.hypot(knees.midX - hips.midX, knees.midY - hips.midY)
  const size = fitAspect(Math.max(hips.distance, knees.distance) * 1.15, regionHeight, imageAspect)
  if (!size) return null
  return { cx: (hips.midX + knees.midX) / 2, cy: (hips.midY + knees.midY) / 2, width: size.width, height: size.height, angle: hips.angle }
}

export function pantsPlacement(
  landmarks: readonly Landmark[],
  width: number,
  height: number,
  imageAspect: number,
  mirrored = true,
): Placement | null {
  const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP]
  const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP]
  const leftAnkle = landmarks[POSE_LANDMARKS.LEFT_ANKLE]
  const rightAnkle = landmarks[POSE_LANDMARKS.RIGHT_ANKLE]
  if (!validPosePoints([leftHip, rightHip, leftAnkle, rightAnkle], imageAspect)) return null

  const hips = screenLine(leftHip, rightHip, width, height, mirrored)
  const ankles = screenLine(leftAnkle, rightAnkle, width, height, mirrored)
  const regionHeight = Math.hypot(ankles.midX - hips.midX, ankles.midY - hips.midY)
  const size = fitAspect(hips.distance * 1.20, regionHeight, imageAspect)
  if (!size) return null
  return { cx: (hips.midX + ankles.midX) / 2, cy: (hips.midY + ankles.midY) / 2, width: size.width, height: size.height, angle: hips.angle }
}

function anchoredPlacement(
  anchor: { midX: number; midY: number; angle: number },
  bodyWidth: number,
  bodyHeight: number,
  imageAspect: number,
  topOffset = 0,
): Placement | null {
  const size = fitAspect(bodyWidth, bodyHeight, imageAspect)
  if (!size) return null
  const top = offsetAlong(anchor.midX, anchor.midY, anchor.angle, topOffset)
  const center = offsetAlong(top.x, top.y, anchor.angle, size.height / 2)
  return { cx: center.x, cy: center.y, width: size.width, height: size.height, angle: anchor.angle }
}

export function shortDressPlacement(
  landmarks: readonly Landmark[], width: number, height: number, imageAspect: number, mirrored = true,
): Placement | null {
  const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER]
  const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER]
  const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP]
  const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP]
  const leftKnee = landmarks[POSE_LANDMARKS.LEFT_KNEE]
  const rightKnee = landmarks[POSE_LANDMARKS.RIGHT_KNEE]
  if (!validPosePoints([leftShoulder, rightShoulder, leftHip, rightHip, leftKnee, rightKnee], imageAspect)) return null
  const shoulders = screenLine(leftShoulder, rightShoulder, width, height, mirrored)
  const hips = screenLine(leftHip, rightHip, width, height, mirrored)
  const knees = screenLine(leftKnee, rightKnee, width, height, mirrored)
  const shoulderToKnee = Math.hypot(knees.midX - shoulders.midX, knees.midY - shoulders.midY)
  const basePlacement = anchoredPlacement(shoulders, Math.max(shoulders.distance, hips.distance) * 1.18, shoulderToKnee * 0.96, imageAspect, -shoulders.distance * 0.12)
  if (!basePlacement) return null

  const SHORT_DRESS_SCALE = 2.20
  const VERTICAL_LIFT_RATIO = -0.40
  const verticalLift = basePlacement.height * VERTICAL_LIFT_RATIO
  const center = offsetAlong(basePlacement.cx, basePlacement.cy, shoulders.angle, -verticalLift)

  return {
    cx: center.x,
    cy: center.y,
    width: basePlacement.width * SHORT_DRESS_SCALE,
    height: basePlacement.height * SHORT_DRESS_SCALE,
    angle: shoulders.angle,
  }
}

export function longDressPlacement(
  landmarks: readonly Landmark[],
  width: number,
  height: number,
  imageAspect: number,
  mirrored = true,
): Placement | null {
  const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER]
  const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER]
  const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP]
  const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP]
  const leftKnee = landmarks[POSE_LANDMARKS.LEFT_KNEE]
  const rightKnee = landmarks[POSE_LANDMARKS.RIGHT_KNEE]
  const leftAnkle = landmarks[POSE_LANDMARKS.LEFT_ANKLE]
  const rightAnkle = landmarks[POSE_LANDMARKS.RIGHT_ANKLE]

  if (!validPosePoints([leftShoulder, rightShoulder, leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle], imageAspect)) return null

  const shoulders = screenLine(leftShoulder, rightShoulder, width, height, mirrored)
  const hips = screenLine(leftHip, rightHip, width, height, mirrored)
  const ankles = screenLine(leftAnkle, rightAnkle, width, height, mirrored)

  const shoulderToAnkle = Math.hypot(ankles.midX - shoulders.midX, ankles.midY - shoulders.midY)

  const baseWidth = Math.max(shoulders.distance, hips.distance) * 1.16
  const baseHeight = shoulderToAnkle * 0.98

  const finalWidth = baseWidth * 3.10
  const finalHeight = baseHeight * 3.10

  const offsetY = -(shoulders.distance * 0.12) - (baseHeight * 0.10)

  return anchoredPlacement(
    shoulders,
    finalWidth,
    finalHeight,
    imageAspect,
    offsetY,
  )
}

export function shortSkirtPlacement(
  landmarks: readonly Landmark[],
  width: number,
  height: number,
  imageAspect: number,
  mirrored = true,
): Placement | null {
  const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP]
  const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP]
  const leftKnee = landmarks[POSE_LANDMARKS.LEFT_KNEE]
  const rightKnee = landmarks[POSE_LANDMARKS.RIGHT_KNEE]

  if (!validPosePoints(
    [leftHip, rightHip, leftKnee, rightKnee],
    imageAspect,
  )) return null

  const hips = screenLine(
    leftHip,
    rightHip,
    width,
    height,
    mirrored,
  )

  const knees = screenLine(
    leftKnee,
    rightKnee,
    width,
    height,
    mirrored,
  )

  const hipToKnee = Math.hypot(
    knees.midX - hips.midX,
    knees.midY - hips.midY,
  )

  if (!(hips.distance > 0) || !(hipToKnee > 0)) return null

  // Tamaño base proporcional al cuerpo.
  const baseWidth = Math.max(
    hips.distance,
    knees.distance,
  ) * 1.16

  const baseHeight = hipToKnee * 0.94

  const baseSize = fitAspect(
    baseWidth,
    baseHeight,
    imageAspect,
  )

  if (!baseSize) return null

  // Aumentar 200% más respecto al tamaño actual:
  // tamaño final = 300% = x3.
  const SHORT_SKIRT_SCALE = 3.5

  const skirtWidth = baseSize.width * SHORT_SKIRT_SCALE
  const skirtHeight = baseSize.height * SHORT_SKIRT_SCALE

  // Subir 30% del tamaño actual/final para acercar
  // la parte superior a la cintura.
  const VERTICAL_LIFT_RATIO = 0.10

  const baseCenterX = (hips.midX + knees.midX) / 2
  const baseCenterY = (hips.midY + knees.midY) / 2

  const center = offsetAlong(
    baseCenterX,
    baseCenterY,
    hips.angle,
    -skirtHeight * VERTICAL_LIFT_RATIO,
  )

  return {
    cx: center.x,
    cy: center.y,
    width: skirtWidth,
    height: skirtHeight,
    angle: hips.angle,
  }
}

let lastLongSkirtDebugAt = 0

export function longSkirtPlacement(
  landmarks: readonly Landmark[], width: number, height: number, imageAspect: number, mirrored = true,
): Placement | null {
  const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER]
  const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER]
  const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP]
  const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP]
  const leftKnee = landmarks[POSE_LANDMARKS.LEFT_KNEE]
  const rightKnee = landmarks[POSE_LANDMARKS.RIGHT_KNEE]
  const leftAnkle = landmarks[POSE_LANDMARKS.LEFT_ANKLE]
  const rightAnkle = landmarks[POSE_LANDMARKS.RIGHT_ANKLE]
  if (!validPosePoints([
    leftShoulder, rightShoulder, leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle,
  ], imageAspect)) return null

  const shoulders = screenLine(leftShoulder, rightShoulder, width, height, mirrored)
  const hips = screenLine(leftHip, rightHip, width, height, mirrored)
  const ankles = screenLine(leftAnkle, rightAnkle, width, height, mirrored)
  const hipWidth = hips.distance
  const waistY = hips.midY - (hips.midY - shoulders.midY) * 0.35
  const waistWidth = hipWidth * 0.82
  const targetSkirtWidth = waistWidth * 4
  const targetSkirtHeight = Math.abs(ankles.midY - waistY) * 1.35
  const fitted = fitAspect(targetSkirtWidth, targetSkirtHeight, imageAspect)
  if (!fitted) return null

  // `fitAspect` conserva la proporción dentro del área objetivo. La ampliación posterior hace que
  // ninguna dimensión quede por debajo del ancho/alto solicitado para esta falda deliberadamente grande.
  const coverScale = Math.max(targetSkirtWidth / fitted.width, targetSkirtHeight / fitted.height)
  const skirtWidth = fitted.width * coverScale
  const skirtHeight = fitted.height * coverScale
  const center = offsetAlong(hips.midX, waistY, hips.angle, skirtHeight / 2)

  if (import.meta.env.DEV) {
    const now = performance.now()
    if (now - lastLongSkirtDebugAt >= 1_000) {
      lastLongSkirtDebugAt = now
      console.debug('[FALDA_LARGA]', { hipWidth, waistWidth, skirtWidth, skirtHeight, waistY })
    }
  }

  return { cx: center.x, cy: center.y, width: skirtWidth, height: skirtHeight, angle: hips.angle }
}

export function necklacePlacement(
  landmarks: readonly Landmark[], width: number, height: number, imageAspect: number, mirrored = true,
): Placement | null {
  const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER]
  const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER]
  const mouthLeft = landmarks[POSE_LANDMARKS.MOUTH_LEFT]
  const mouthRight = landmarks[POSE_LANDMARKS.MOUTH_RIGHT]
  const nose = landmarks[POSE_LANDMARKS.NOSE]
  if (!validPosePoints([leftShoulder, rightShoulder], imageAspect)) return null
  const facePoint = mouthLeft && mouthRight && (mouthLeft.visibility ?? 1) >= POSE_MIN_VISIBILITY && (mouthRight.visibility ?? 1) >= POSE_MIN_VISIBILITY
    ? screenLine(mouthLeft, mouthRight, width, height, mirrored)
    : nose && (nose.visibility ?? 1) >= POSE_MIN_VISIBILITY
      ? { ...toCanvasPoint(nose, width, height, mirrored), midX: toCanvasPoint(nose, width, height, mirrored).x, midY: toCanvasPoint(nose, width, height, mirrored).y }
      : null
  if (!facePoint) return null
  const shoulders = screenLine(leftShoulder, rightShoulder, width, height, mirrored)
  const neckCenter = {
    x: shoulders.midX * 0.72 + facePoint.midX * 0.28,
    y: shoulders.midY * 0.72 + facePoint.midY * 0.28,
  }
  const necklaceWidth = shoulders.distance * 0.52
  return { cx: neckCenter.x, cy: neckCenter.y, width: necklaceWidth, height: necklaceWidth * imageAspect, angle: shoulders.angle }
}

export function scarfPlacement(
  landmarks: readonly Landmark[], width: number, height: number, imageAspect: number, mirrored = true,
): Placement | null {
  const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER]
  const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER]
  if (!validPosePoints([leftShoulder, rightShoulder], imageAspect)) return null
  const shoulders = screenLine(leftShoulder, rightShoulder, width, height, mirrored)
  const scarfWidth = shoulders.distance * 1.28
  const center = offsetAlong(shoulders.midX, shoulders.midY, shoulders.angle, -shoulders.distance * 0.14)
  return { cx: center.x, cy: center.y, width: scarfWidth, height: scarfWidth * imageAspect, angle: shoulders.angle }
}

export function bagPlacement(
  landmarks: readonly Landmark[], width: number, height: number, imageAspect: number, mirrored = true,
): Placement | null {
  const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER]
  const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER]
  const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP]
  const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP]
  if (!validPosePoints([leftShoulder, rightShoulder, leftHip, rightHip], imageAspect)) return null
  const shoulders = screenLine(leftShoulder, rightShoulder, width, height, mirrored)
  const hips = screenLine(leftHip, rightHip, width, height, mirrored)
  const torsoHeight = Math.hypot(hips.midX - shoulders.midX, hips.midY - shoulders.midY)
  const size = fitAspect(shoulders.distance * 0.62, torsoHeight * 0.72, imageAspect)
  if (!size) return null

  const wristCandidates = [landmarks[POSE_LANDMARKS.RIGHT_WRIST], landmarks[POSE_LANDMARKS.LEFT_WRIST]]
    .filter((point): point is Landmark => Boolean(point) && (point.visibility ?? 1) >= POSE_MIN_VISIBILITY)
    .map(point => toCanvasPoint(point, width, height, mirrored))
  const hipCandidates = [toCanvasPoint(rightHip, width, height, mirrored), toCanvasPoint(leftHip, width, height, mirrored)]
  const wrist = wristCandidates.sort((a, b) => Math.abs(b.x - hips.midX) - Math.abs(a.x - hips.midX))[0]
  const sideHip = hipCandidates.sort((a, b) => wrist
    ? Math.hypot(a.x - wrist.x, a.y - wrist.y) - Math.hypot(b.x - wrist.x, b.y - wrist.y)
    : Math.abs(b.x - hips.midX) - Math.abs(a.x - hips.midX))[0]
  const center = wrist
    ? { x: wrist.x * 0.58 + sideHip.x * 0.42, y: wrist.y * 0.58 + sideHip.y * 0.42 }
    : { x: sideHip.x + (sideHip.x - hips.midX) * 0.45, y: sideHip.y }
  return { cx: center.x, cy: center.y, width: size.width, height: size.height, angle: shoulders.angle }
}
