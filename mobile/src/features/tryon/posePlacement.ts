import { fitAspect, screenLine, type Landmark, type Placement } from './geometry';
import type { GarmentType } from './strategies';

export interface GarmentPlacementInput {
  landmarks: readonly Landmark[];
  width: number;
  height: number;
  imageAspect: number;
  mirrored?: boolean;
  mode?: 'photo' | 'live';
  garmentType?: GarmentType;
}

const MIN_VISIBILITY = 0.5;
const visible = (p?: Landmark, minimum = MIN_VISIBILITY) => Boolean(p && (p.visibility ?? 1) >= minimum);

export type UpperBodyPlacementResult = {
  placement: Placement;
  shoulderWidth: number;
  torsoHeight: number;
  shirtWidth: number;
  shirtHeight: number;
  shoulderCenterY: number;
  hipCenterY: number | null;
  leftShoulderVisibility: number;
  rightShoulderVisibility: number;
  leftHipVisibility: number;
  rightHipVisibility: number;
  usedHipFallback: boolean;
};

export function upperBodyPlacement({ landmarks: lm, width, height, mirrored = false, mode = 'photo', garmentType }: GarmentPlacementInput): UpperBodyPlacementResult | null {
  const ls = lm[11], rs = lm[12], lh = lm[23], rh = lm[24];
  const calibratedShirt = garmentType === 'CAMISA' || garmentType === 'BLUSA';
  const upperBodyLive = mode === 'live' && (calibratedShirt || garmentType === 'TOP');
  const minimumVisibility = upperBodyLive ? 0.25 : MIN_VISIBILITY;
  if (![ls, rs].every((point) => visible(point, minimumVisibility))) return null;
  const shoulders = screenLine(ls!, rs!, width, height, mirrored);
  const hipsAvailable = [lh, rh].every((point) => visible(point, minimumVisibility));
  const hips = hipsAvailable ? screenLine(lh!, rh!, width, height, mirrored) : null;
  const torsoHeight = hips
    ? Math.abs(hips.midY - shoulders.midY)
    : shoulders.distance * (upperBodyLive ? 1.30 : 1.25);
  if (!(shoulders.distance > 0) || !(torsoHeight > 0)) return null;
  const shirtWidth = calibratedShirt
    ? mode === 'live'
      ? Math.max(shoulders.distance * 2.35, (hips?.distance ?? 0) * 1.20)
      : shoulders.distance * 2.85 * 0.90
    : shoulders.distance * (mode === 'live' ? 1.78 : 1.85);
  const shirtHeight = calibratedShirt
    ? torsoHeight * (mode === 'live' ? 1.55 : 1.72 * 0.90)
    : torsoHeight * (mode === 'live' ? 1.34 : 1.42);
  const centerX = hips ? (shoulders.midX + hips.midX) / 2 : shoulders.midX;
  let centerY: number;
  if (calibratedShirt && mode === 'live') {
    const shirtTopY = shoulders.midY - shirtHeight * 0.17;
    centerY = shirtTopY + shirtHeight / 2;
  } else if (calibratedShirt) {
    const previousHeight = torsoHeight * 1.72;
    const previousTopY = shoulders.midY - previousHeight * 0.28;
    const previousCenterY = previousTopY + previousHeight / 2;
    const currentCenterY = previousCenterY + shirtHeight * 0.06;
    centerY = currentCenterY - shirtHeight * 0.04;
  } else {
    const shirtTopY = shoulders.midY - shirtHeight * (mode === 'live' ? 0.08 : 0.10);
    centerY = shirtTopY + shirtHeight / 2;
  }
  return {
    placement: { cx: centerX, cy: centerY, width: shirtWidth, height: shirtHeight, angle: shoulders.angle },
    shoulderWidth: shoulders.distance,
    torsoHeight,
    shirtWidth,
    shirtHeight,
    shoulderCenterY: shoulders.midY,
    hipCenterY: hips?.midY ?? null,
    leftShoulderVisibility: ls?.visibility ?? 1,
    rightShoulderVisibility: rs?.visibility ?? 1,
    leftHipVisibility: lh?.visibility ?? 0,
    rightHipVisibility: rh?.visibility ?? 0,
    usedHipFallback: !hipsAvailable,
  };
}

export function posePlacement(type: GarmentType, { landmarks: lm, width, height, imageAspect, mirrored = false, mode = 'photo' }: GarmentPlacementInput): Placement | null {
  const ls = lm[11], rs = lm[12], lh = lm[23], rh = lm[24], lk = lm[25], rk = lm[26], la = lm[27], ra = lm[28];
  let topA: Landmark, topB: Landmark, bottomA: Landmark, bottomB: Landmark;
  let reference: ReturnType<typeof screenLine>;
  let targetWidth: number;

  if (type === 'CAMISA' || type === 'BLUSA' || type === 'TOP') {
    return upperBodyPlacement({ landmarks: lm, width, height, imageAspect, mirrored, mode, garmentType: type })?.placement ?? null;
  } else if (type === 'OTRO') {
    if (![ls, rs, lh, rh].every(visible)) return null;
    const shoulders = screenLine(ls!, rs!, width, height, mirrored);
    const hips = screenLine(lh!, rh!, width, height, mirrored);
    const torsoWidth = Math.max(shoulders.distance, hips.distance);
    const regionHeight = Math.hypot(hips.midX - shoulders.midX, hips.midY - shoulders.midY);
    const size = fitAspect(torsoWidth * 1.18, regionHeight * 1.12, imageAspect);
    if (!size || !regionHeight) return null;
    return { cx: (shoulders.midX + hips.midX) / 2, cy: (shoulders.midY + hips.midY) / 2, width: size.width, height: size.height, angle: shoulders.angle };
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
