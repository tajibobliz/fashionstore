// Geometría compartida por los tres tipos de vestidor (lentes, gorra, polera): convierte puntos de
// MediaPipe (normalizados 0..1) en coordenadas de canvas y arma la línea que define escala y rotación
// de la prenda. Cada tipo de prenda (faceOverlay.ts, poseOverlay.ts) construye su `Placement` con esto.

/** Punto de MediaPipe: coordenadas NORMALIZADAS (0..1) sobre el frame de video sin espejar. */
export interface Landmark {
  x: number
  y: number
  /** Solo lo informa PoseLandmarker (no FaceLandmarker): qué tan confiable es el punto, 0..1. */
  visibility?: number
}

/** Dónde y cómo dibujar el PNG. Todo en píxeles del canvas; `angle` en radianes (sentido horario). */
export interface Placement {
  cx: number
  cy: number
  width: number
  height: number
  angle: number
}

/** Punto normalizado -> píxeles de canvas. Con `mirrored` invierte X (vista tipo espejo/selfie). */
export function toCanvasPoint(point: Landmark, width: number, height: number, mirrored: boolean) {
  return { x: (mirrored ? 1 - point.x : point.x) * width, y: point.y * height }
}

/**
 * Convierte dos puntos de referencia (dos ojos, dos mejillas, dos hombros...) en la línea que define la
 * orientación de la prenda: punto medio (dónde centrarla), distancia (para escalarla) y ángulo (para rotarla).
 * Los puntos se ordenan de izquierda a derecha EN PANTALLA antes de medir el ángulo: así su signo no depende
 * de cuál landmark es "a" y cuál es "b", ni de si el video está espejado.
 */
export function screenLine(a: Landmark, b: Landmark, width: number, height: number, mirrored: boolean) {
  const pa = toCanvasPoint(a, width, height, mirrored)
  const pb = toCanvasPoint(b, width, height, mirrored)
  const [start, end] = pa.x <= pb.x ? [pa, pb] : [pb, pa]
  const dx = end.x - start.x
  const dy = end.y - start.y
  return { midX: (start.x + end.x) / 2, midY: (start.y + end.y) / 2, distance: Math.hypot(dx, dy), angle: Math.atan2(dy, dx) }
}

/** Desplaza (x, y) a lo largo del eje "hacia abajo" de la prenda (perpendicular a `angle`; + = hacia abajo, - = hacia arriba). */
export function offsetAlong(x: number, y: number, angle: number, distance: number) {
  return { x: x - Math.sin(angle) * distance, y: y + Math.cos(angle) * distance }
}

/**
 * Suaviza el movimiento entre frames: los puntos de MediaPipe "tiemblan" ligeramente y eso hace vibrar
 * el PNG. Media móvil exponencial: alpha=1 sigue al dato nuevo sin suavizar; valores menores lo amortiguan.
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

/** Dibuja el PNG centrado en (cx, cy) y rotado `angle` radianes sobre su propio centro. */
export function drawPlacement(ctx: CanvasRenderingContext2D, image: CanvasImageSource, placement: Placement) {
  ctx.save()
  ctx.translate(placement.cx, placement.cy)
  ctx.rotate(placement.angle)
  ctx.drawImage(image, -placement.width / 2, -placement.height / 2, placement.width, placement.height)
  ctx.restore()
}
