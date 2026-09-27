import { screenLine, toCanvasPoint, type Placement } from './geometry';
import type { GarmentPlacementInput } from './posePlacement';

// Mobile pose model landmarks: nose 0, eyes 2/5, ears 7/8, shoulders 11/12.
export interface HatOverlayResult {
  visible: boolean;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  rotationDeg: number;
  guidanceMessage: string;
}

type HatOverlayInput = GarmentPlacementInput & { live?: boolean };

const pointVisible = (point: GarmentPlacementInput['landmarks'][number] | undefined) =>
  Boolean(point && (point.visibility ?? 1) >= 0.35);

export function getHatOverlayFromPose({ landmarks: lm, width, height, imageAspect, mirrored = false, live = false }: HatOverlayInput): HatOverlayResult {
  const nose = lm[0], eyeLeft = lm[2], eyeRight = lm[5], earLeft = lm[7], earRight = lm[8];
  const hasEyes = pointVisible(eyeLeft) && pointVisible(eyeRight);
  const hasEars = pointVisible(earLeft) && pointVisible(earRight);
  const hasNose = pointVisible(nose);
  const hidden = (guidanceMessage: string): HatOverlayResult => ({ visible: false, centerX: 0, centerY: 0, width: 0, height: 0, rotationDeg: 0, guidanceMessage });
  if (!hasEyes || (!hasNose && !hasEars) || !(imageAspect > 0)) return hidden('Ubica tu cabeza dentro de la guía');

  const eyes = screenLine(eyeLeft!, eyeRight!, width, height, mirrored);
  const ears = hasEars ? screenLine(earLeft!, earRight!, width, height, mirrored) : null;
  const eyeLeftPoint = toCanvasPoint(eyeLeft!, width, height, mirrored);
  const eyeRightPoint = toCanvasPoint(eyeRight!, width, height, mirrored);
  const eyeCenterX = (eyeLeftPoint.x + eyeRightPoint.x) / 2;
  const eyeCenterY = (eyeLeftPoint.y + eyeRightPoint.y) / 2;
  const headWidth = Math.max(ears?.distance ?? 0, eyes.distance * (live ? 2.3 : 2.2));
  const headCenterX = ears ? ears.midX : eyeCenterX;
  const headRatio = headWidth / width;
  const hatWidth = headWidth * (live ? 1.28 : 1.25);
  const hatHeight = hatWidth / imageAspect;
  // En vivo el borde inferior del PNG queda 30% del ancho de cabeza sobre los ojos:
  // la visera se apoya en frente/cabello sin cubrir ojos ni nariz.
  const visorOffset = headWidth * (live ? 0.3 : 0.08);
  const placement = {
    centerX: headCenterX,
    centerY: eyeCenterY - visorOffset - hatHeight * 0.5,
    width: hatWidth,
    height: hatHeight,
    rotationDeg: eyes.angle * 180 / Math.PI,
  };
  if (headRatio < 0.12) return { ...placement, visible: false, guidanceMessage: 'Acércate un poco' };
  if (headRatio > 0.52) return { ...placement, visible: false, guidanceMessage: 'Aléjate un poco' };
  if (headCenterX < width * 0.1 || headCenterX > width * 0.9 || eyeCenterY < height * 0.06 || eyeCenterY > height * 0.78) {
    return { ...placement, visible: false, guidanceMessage: 'Ubica tu cabeza dentro de la guía' };
  }
  return { ...placement, visible: true, guidanceMessage: 'Posición correcta' };
}

export function facePlacement(input: GarmentPlacementInput): Placement | null {
  const result = getHatOverlayFromPose(input);
  // Foto conserva el autoajuste aunque la escala no sea ideal; Cámara decide visibilidad con `visible`.
  if (!(result.width > 0 && result.height > 0)) return null;
  return { cx: result.centerX, cy: result.centerY, width: result.width, height: result.height, angle: result.rotationDeg * Math.PI / 180 };
}
