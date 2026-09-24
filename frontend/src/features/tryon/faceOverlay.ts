// Geometría del vestidor virtual: convierte los puntos que devuelve MediaPipe en la posición,
// el tamaño y la rotación con que se dibuja el PNG del producto sobre el video.

/** Punto de la malla facial: coordenadas NORMALIZADAS (0..1) sobre el frame de video sin espejar. */
export interface Landmark {
  x: number
  y: number
}

/** Dónde y cómo dibujar el PNG. Todo en píxeles del canvas; `angle` en radianes (sentido horario). */
export interface Placement {
  cx: number
  cy: number
  width: number
  height: number
  angle: number
}

/**
 * Índices de la malla de MediaPipe FaceLandmarker (478 puntos: 468 de la cara + 10 del iris).
 * "Derecho/izquierdo" se refiere al usuario, no a la imagen: en el frame SIN espejar el ojo derecho
 * del usuario aparece a la IZQUIERDA de la imagen.
 */
export const FACE_LANDMARKS = {
  /** Comisura externa del ojo derecho del usuario (la más alejada de la nariz). */
  RIGHT_EYE_OUTER: 33,
  /** Comisura externa del ojo izquierdo del usuario. */
  LEFT_EYE_OUTER: 263,
  // TODO(gorras): la gorra se ancla a la frente y las sienes:
  //   10 = centro de la frente (borde superior del rostro), 67 y 297 = extremos de la frente (sienes),
  //   234 y 454 = laterales del rostro a la altura de las orejas (dan el ancho de la cabeza).
  //   Ancho = distancia 234-454, posicionar sobre el punto 10 con la misma rotación que los ojos.
  // TODO(poleras): FaceLandmarker solo ve la cara. Para el torso hay que sumar PoseLandmarker
  //   (MediaPipe Tasks Vision también): 11 = hombro izquierdo, 12 = hombro derecho, 23/24 = caderas.
  //   Ancho = distancia entre hombros, y el PNG se ancla a los hombros.
} as const

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
 * Idea: dos puntos del rostro (los ojos) definen una recta. De esa recta salen las tres magnitudes que
 * necesita un elemento 2D para "pegarse" a la cara:
 *  - POSICIÓN: el punto medio entre los ojos es el puente de la nariz, donde va el centro de los lentes.
 *  - ESCALA:   la distancia entre ojos cambia al acercarse o alejarse de la cámara, así que el ancho de
 *              los lentes es proporcional a ella (GLASSES_WIDTH_RATIO) y "sigue" el rostro en profundidad.
 *  - ROTACIÓN: el ángulo de la recta ojo-ojo es la inclinación lateral de la cabeza (roll); se rota el PNG
 *              ese mismo ángulo para que acompañe la inclinación.
 *
 * @param landmarks  puntos de MediaPipe para una cara (normalizados, frame sin espejar)
 * @param width      ancho del canvas en px
 * @param height     alto del canvas en px
 * @param imageAspect alto/ancho del PNG (para no deformarlo)
 * @param mirrored   true si el canvas muestra el video espejado (vista tipo selfie)
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

  // Al espejar el video, x se invierte: un punto en x=0.2 del frame se ve en x=0.8 del canvas.
  const toCanvas = (p: Landmark) => ({ x: (mirrored ? 1 - p.x : p.x) * width, y: p.y * height })
  const a = toCanvas(right)
  const b = toCanvas(left)

  // Se ordenan de izquierda a derecha EN PANTALLA: así el ángulo no depende de si el video está espejado
  // (con el espejo, el "ojo derecho" pasa a estar a la derecha de la pantalla y el orden se invertiría).
  const [start, end] = a.x <= b.x ? [a, b] : [b, a]
  const dx = end.x - start.x
  const dy = end.y - start.y
  const eyeDistance = Math.hypot(dx, dy)
  if (eyeDistance === 0) return null

  const angle = Math.atan2(dy, dx)
  const frameWidth = eyeDistance * GLASSES_WIDTH_RATIO

  // El corrimiento vertical se aplica sobre el eje "abajo" de la cara (perpendicular a la recta de los ojos),
  // no sobre el eje Y de la pantalla, para que siga siendo correcto con la cabeza inclinada.
  const offset = eyeDistance * GLASSES_Y_OFFSET_RATIO
  return {
    cx: (start.x + end.x) / 2 - Math.sin(angle) * offset,
    cy: (start.y + end.y) / 2 + Math.cos(angle) * offset,
    width: frameWidth,
    height: frameWidth * imageAspect,
    angle,
  }
}

/**
 * Suaviza el movimiento: los puntos de MediaPipe "tiemblan" ligeramente entre frames y eso hace vibrar el PNG.
 * Media móvil exponencial: alpha=1 sigue al dato nuevo sin suavizar; valores menores lo amortiguan.
 */
export function smoothPlacement(previous: Placement | null, next: Placement, alpha = 0.5): Placement {
  if (!previous) return next
  const mix = (from: number, to: number) => from + (to - from) * alpha
  return {
    cx: mix(previous.cx, next.cx),
    cy: mix(previous.cy, next.cy),
    width: mix(previous.width, next.width),
    height: mix(previous.height, next.height),
    angle: mix(previous.angle, next.angle),
  }
}

/** Dibuja el PNG centrado en (cx, cy) y rotado; la rotación se hace sobre el centro del PNG. */
export function drawPlacement(ctx: CanvasRenderingContext2D, image: CanvasImageSource, placement: Placement) {
  ctx.save()
  ctx.translate(placement.cx, placement.cy)
  ctx.rotate(placement.angle)
  ctx.drawImage(image, -placement.width / 2, -placement.height / 2, placement.width, placement.height)
  ctx.restore()
}
