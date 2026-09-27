import { fitAspect, screenLine, type Landmark, type Placement } from './geometry';
import type { GarmentType } from './strategies';

export interface GarmentPlacementInput {
  landmarks: readonly Landmark[];
  width: number;
  height: number;
  imageAspect: number;
  mirrored?: boolean;
}

const MIN_VISIBILITY = 0.5;
const visible = (p?: Landmark) => Boolean(p && (p.visibility ?? 1) >= MIN_VISIBILITY);

export function posePlacement(type: GarmentType, { landmarks: lm, width, height, imageAspect, mirrored = false }: GarmentPlacementInput): Placement | null {
  const ls = lm[11], rs = lm[12], lh = lm[23], rh = lm[24], lk = lm[25], rk = lm[26], la = lm[27], ra = lm[28];
  let topA: Landmark, topB: Landmark, bottomA: Landmark, bottomB: Landmark;
  let reference: ReturnType<typeof screenLine>;
  let targetWidth: number;

  if (type === 'CAMISA' || type === 'BLUSA' || type === 'TOP' || type === 'OTRO') {
    if (![ls, rs, lh, rh].every(visible)) return null;
    const shoulders = screenLine(ls!, rs!, width, height, mirrored);
    const hips = screenLine(lh!, rh!, width, height, mirrored);
    topA = ls!; topB = rs!; bottomA = lh!; bottomB = rh!;
    reference = shoulders;
    const torsoWidth = Math.max(shoulders.distance, hips.distance);
    const regionHeight = Math.hypot(hips.midX - shoulders.midX, hips.midY - shoulders.midY);
    const size = fitAspect(torsoWidth * 1.18, regionHeight * 1.12, imageAspect);
    if (!size || !regionHeight) return null;
    const centerX = (shoulders.midX + hips.midX) / 2;
    const centerY = (shoulders.midY + hips.midY) / 2;
    return { cx: centerX, cy: centerY, width: size.width, height: size.height, angle: shoulders.angle };
  } else if (type === 'VESTIDO') {
    if (![ls, rs, lh, rh, lk, rk].every(visible)) return null;
    const shoulders = screenLine(ls!, rs!, width, height, mirrored);
    const hips = screenLine(lh!, rh!, width, height, mirrored);
    const knees = screenLine(lk!, rk!, width, height, mirrored);
    topA = ls!; topB = rs!; bottomA = lk!; bottomB = rk!;
    reference = shoulders;
    targetWidth = Math.max(shoulders.distance, hips.distance, knees.distance) * 1.1;
  } else if (type === 'FALDA') {
    if (![lh, rh, lk, rk].every(visible)) return null;
    const hips = screenLine(lh!, rh!, width, height, mirrored);
    const knees = screenLine(lk!, rk!, width, height, mirrored);
    topA = lh!; topB = rh!; bottomA = lk!; bottomB = rk!;
    reference = hips;
    targetWidth = Math.max(hips.distance, knees.distance) * 1.15;
  } else if (type === 'PANTALON') {
    if (![lh, rh, la, ra].every(visible)) return null;
    const hips = screenLine(lh!, rh!, width, height, mirrored);
    screenLine(la!, ra!, width, height, mirrored);
    topA = lh!; topB = rh!; bottomA = la!; bottomB = ra!;
    reference = hips;
    targetWidth = hips.distance * 1.2;
  } else {
    return null;
  }

  const top = screenLine(topA, topB, width, height, mirrored);
  const bottom = screenLine(bottomA, bottomB, width, height, mirrored);
  const regionHeight = Math.hypot(bottom.midX - top.midX, bottom.midY - top.midY);
  const centerX = (top.midX + bottom.midX) / 2;
  const centerY = (top.midY + bottom.midY) / 2;
  const size = fitAspect(targetWidth!, regionHeight, imageAspect);
  if (!size || !regionHeight) return null;
  return { cx: centerX, cy: centerY, width: size.width, height: size.height, angle: reference.angle };
}
