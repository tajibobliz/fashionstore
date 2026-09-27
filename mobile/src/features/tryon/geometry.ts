export type Landmark = { x: number; y: number; visibility?: number };

export interface Placement {
  cx: number;
  cy: number;
  width: number;
  height: number;
  angle: number;
}

export function toCanvasPoint(point: Landmark, width: number, height: number, mirrored: boolean) {
  return { x: (mirrored ? 1 - point.x : point.x) * width, y: point.y * height };
}

export function screenLine(a: Landmark, b: Landmark, width: number, height: number, mirrored: boolean) {
  const pa = toCanvasPoint(a, width, height, mirrored);
  const pb = toCanvasPoint(b, width, height, mirrored);
  const [start, end] = pa.x <= pb.x ? [pa, pb] : [pb, pa];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return { midX: (start.x + end.x) / 2, midY: (start.y + end.y) / 2, distance: Math.hypot(dx, dy), angle: Math.atan2(dy, dx) };
}

export function offsetAlong(x: number, y: number, angle: number, distance: number) {
  return { x: x - Math.sin(angle) * distance, y: y + Math.cos(angle) * distance };
}

export function smoothPlacement(previous: Placement | null, next: Placement, alpha = 0.35): Placement {
  if (!previous) return next;
  const mix = (from: number, to: number) => from + (to - from) * alpha;
  let angleDelta = next.angle - previous.angle;
  while (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
  while (angleDelta < -Math.PI) angleDelta += Math.PI * 2;
  return {
    cx: mix(previous.cx, next.cx), cy: mix(previous.cy, next.cy),
    width: mix(previous.width, next.width), height: mix(previous.height, next.height),
    angle: previous.angle + angleDelta * alpha,
  };
}

export function fitAspect(width: number, height: number, imageAspect: number) {
  if (!(width > 0 && height > 0 && imageAspect > 0)) return null;
  if (width / height > imageAspect) return { width: height * imageAspect, height };
  return { width, height: width / imageAspect };
}
