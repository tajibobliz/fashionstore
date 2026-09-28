import type { Face } from 'react-native-vision-camera-face-detector';

export type Size = { width: number; height: number };
export type CameraFacing = 'front' | 'back';

export type MappedFace = {
  bounds: { x: number; y: number; width: number; height: number };
  leftEye?: { x: number; y: number };
  rightEye?: { x: number; y: number };
  leftEar?: { x: number; y: number };
  rightEar?: { x: number; y: number };
  eyebrowY?: number;
  rollAngle: number;
};

export type HatGeometryInput = Pick<MappedFace, 'bounds' | 'leftEye' | 'rightEye' | 'leftEar' | 'rightEar' | 'eyebrowY' | 'rollAngle'> & {
  imageAspect: number;
  mode: 'photo' | 'live';
};

export type HatPlacement = {
  visible: boolean;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  rotationDeg: number;
  earWidth: number;
  headWidth: number;
  hatBottomY: number;
  guidanceMessage: string;
};

export const HAT_FROM_FACE_FACTOR = 1.85;
export const HAT_FROM_EARS_FACTOR = 2.10;
export const HAT_FINAL_EXPANSION = 1.08;

function validSize(size: Size) {
  return Number.isFinite(size.width) && Number.isFinite(size.height) && size.width > 0 && size.height > 0;
}

/** Maps raw detector coordinates to a resizeMode="cover" preview. Front mirroring is applied exactly once here. */
export function mapFaceToPreview(face: Face, frameSize: Size, previewSize: Size, cameraFacing: CameraFacing): MappedFace | null {
  if (!validSize(frameSize) || !validSize(previewSize)) return null;
  const scale = Math.max(previewSize.width / frameSize.width, previewSize.height / frameSize.height);
  const offsetX = (previewSize.width - frameSize.width * scale) / 2;
  const offsetY = (previewSize.height - frameSize.height * scale) / 2;
  const mapPoint = (point?: { x: number; y: number }) => {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return undefined;
    const sourceX = cameraFacing === 'front' ? frameSize.width - point.x : point.x;
    return { x: offsetX + sourceX * scale, y: offsetY + point.y * scale };
  };
  const eyebrowPoints = [
    ...(face.contours?.LEFT_EYEBROW_TOP ?? []),
    ...(face.contours?.RIGHT_EYEBROW_TOP ?? []),
  ].map(mapPoint).filter((point): point is { x: number; y: number } => Boolean(point));
  const first = mapPoint({ x: face.bounds.x, y: face.bounds.y });
  const second = mapPoint({ x: face.bounds.x + face.bounds.width, y: face.bounds.y + face.bounds.height });
  if (!first || !second) return null;
  return {
    bounds: { x: Math.min(first.x, second.x), y: Math.min(first.y, second.y), width: Math.abs(second.x - first.x), height: Math.abs(second.y - first.y) },
    leftEye: mapPoint(face.landmarks?.LEFT_EYE),
    rightEye: mapPoint(face.landmarks?.RIGHT_EYE),
    leftEar: mapPoint(face.landmarks?.LEFT_EAR),
    rightEar: mapPoint(face.landmarks?.RIGHT_EAR),
    eyebrowY: eyebrowPoints.length ? eyebrowPoints.reduce((sum, point) => sum + point.y, 0) / eyebrowPoints.length : undefined,
    rollAngle: cameraFacing === 'front' ? -face.rollAngle : face.rollAngle,
  };
}

export function mappedFaceFromPreview(face: Face): MappedFace {
  return {
    bounds: face.bounds,
    leftEye: face.landmarks?.LEFT_EYE,
    rightEye: face.landmarks?.RIGHT_EYE,
    leftEar: face.landmarks?.LEFT_EAR,
    rightEar: face.landmarks?.RIGHT_EAR,
    rollAngle: face.rollAngle,
  };
}

export function computeHatPlacement(input: HatGeometryInput) {
  const { bounds } = input;
  const earWidth = input.leftEar && input.rightEar
    ? Math.hypot(input.rightEar.x - input.leftEar.x, input.rightEar.y - input.leftEar.y)
    : 0;
  const validEarWidth = earWidth >= bounds.width * 0.85 && earWidth <= bounds.width * 1.60;
  const baseHatWidth = bounds.width * HAT_FROM_FACE_FACTOR;
  const baseFromEars = validEarWidth ? earWidth * HAT_FROM_EARS_FACTOR : 0;
  const calibratedWidth = Math.max(baseHatWidth, baseFromEars) * HAT_FINAL_EXPANSION;
  const width = calibratedWidth * (input.mode === 'photo' ? 0.85 : 0.75);
  const headWidth = Math.max(bounds.width, validEarWidth ? earWidth : bounds.width);
  const earCenterX = validEarWidth ? (input.leftEar!.x + input.rightEar!.x) / 2 : undefined;
  const faceCenterX = bounds.x + bounds.width / 2;
  const centerX = earCenterX !== undefined && Math.abs(earCenterX - faceCenterX) <= bounds.width * 0.20 ? earCenterX : faceCenterX;
  const height = width / input.imageAspect;
  const screenLeftEye = input.leftEye && input.rightEye && input.leftEye.x <= input.rightEye.x ? input.leftEye : input.rightEye;
  const screenRightEye = input.leftEye && input.rightEye && input.leftEye.x <= input.rightEye.x ? input.rightEye : input.leftEye;
  const rotationDeg = screenLeftEye && screenRightEye
    ? Math.atan2(screenRightEye.y - screenLeftEye.y, screenRightEye.x - screenLeftEye.x) * 180 / Math.PI
    : input.rollAngle;
  const eyeCenterY = input.leftEye && input.rightEye ? (input.leftEye.y + input.rightEye.y) / 2 : bounds.y + bounds.height * 0.42;
  const hatBottomY = input.mode === 'photo'
    ? input.eyebrowY !== undefined
      ? input.eyebrowY + bounds.height * 0.12
      : eyeCenterY + bounds.height * 0.06
    : eyeCenterY + bounds.height * 0.05;
  const centerY = hatBottomY - height / 2;
  return { centerX, centerY, width, height, rotationDeg: Math.max(-30, Math.min(30, rotationDeg)), earWidth, headWidth, hatBottomY };
}

export function getHatPlacementFromFace(face: MappedFace, imageAspect: number, previewSize: Size, mode: 'photo' | 'live'): HatPlacement {
  const placement = computeHatPlacement({ ...face, imageAspect, mode });
  const { bounds } = face;
  const visibleWidth = Math.max(0, Math.min(bounds.x + bounds.width, previewSize.width) - Math.max(bounds.x, 0));
  const visibleHeight = Math.max(0, Math.min(bounds.y + bounds.height, previewSize.height) - Math.max(bounds.y, 0));
  const validBounds = bounds.width > 0 && bounds.height > 0;
  const sufficientlyInside = validBounds && visibleWidth * visibleHeight >= bounds.width * bounds.height * 0.15;
  const relativeWidth = placement.width / previewSize.width;
  const guidanceMessage = !sufficientlyInside ? 'Ubica tu cabeza dentro de la guía'
    : relativeWidth < 0.18 ? 'Acércate un poco'
      : relativeWidth > 0.62 ? 'Aléjate un poco' : 'Posición correcta';
  return {
    visible: sufficientlyInside,
    ...placement,
    guidanceMessage,
  };
}
