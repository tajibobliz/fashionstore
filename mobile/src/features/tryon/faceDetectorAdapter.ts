import type { Face } from 'react-native-vision-camera-face-detector';

export type Size = { width: number; height: number };
export type CameraFacing = 'front' | 'back';

export type MappedFace = {
  bounds: { x: number; y: number; width: number; height: number };
  leftEye?: { x: number; y: number };
  rightEye?: { x: number; y: number };
  leftEar?: { x: number; y: number };
  rightEar?: { x: number; y: number };
  rollAngle: number;
};

export type HatPlacement = {
  visible: boolean;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  rotationDeg: number;
  headWidth: number;
  hatBottomY: number;
  guidanceMessage: string;
};

export const HAT_EAR_FACTOR = 1.10;
export const HEAD_FROM_FACE_FACTOR = 1.08;
export const HAT_WIDTH_FACTOR = 1.05;
export const HAT_BROW_OFFSET = 0.15;

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
  const first = mapPoint({ x: face.bounds.x, y: face.bounds.y });
  const second = mapPoint({ x: face.bounds.x + face.bounds.width, y: face.bounds.y + face.bounds.height });
  if (!first || !second) return null;
  return {
    bounds: { x: Math.min(first.x, second.x), y: Math.min(first.y, second.y), width: Math.abs(second.x - first.x), height: Math.abs(second.y - first.y) },
    leftEye: mapPoint(face.landmarks?.LEFT_EYE),
    rightEye: mapPoint(face.landmarks?.RIGHT_EYE),
    leftEar: mapPoint(face.landmarks?.LEFT_EAR),
    rightEar: mapPoint(face.landmarks?.RIGHT_EAR),
    rollAngle: cameraFacing === 'front' ? -face.rollAngle : face.rollAngle,
  };
}

export function getHatPlacementFromFace(face: MappedFace, imageAspect: number, previewSize: Size): HatPlacement {
  const { bounds } = face;
  const hasEars = Boolean(face.leftEar && face.rightEar);
  const headWidth = hasEars
    ? Math.hypot(face.rightEar!.x - face.leftEar!.x, face.rightEar!.y - face.leftEar!.y)
    : bounds.width * HEAD_FROM_FACE_FACTOR;
  const width = headWidth * (hasEars ? HAT_EAR_FACTOR : HAT_WIDTH_FACTOR);
  const height = width / imageAspect;
  const centerX = hasEars ? (face.leftEar!.x + face.rightEar!.x) / 2 : bounds.x + bounds.width / 2;
  const screenLeftEye = face.leftEye && face.rightEye && face.leftEye.x <= face.rightEye.x ? face.leftEye : face.rightEye;
  const screenRightEye = face.leftEye && face.rightEye && face.leftEye.x <= face.rightEye.x ? face.rightEye : face.leftEye;
  const rotationDeg = screenLeftEye && screenRightEye
    ? Math.atan2(screenRightEye.y - screenLeftEye.y, screenRightEye.x - screenLeftEye.x) * 180 / Math.PI
    : face.rollAngle;
  const eyeCenterY = face.leftEye && face.rightEye ? (face.leftEye.y + face.rightEye.y) / 2 : bounds.y + bounds.height * 0.42;
  const hatBottomY = eyeCenterY - bounds.height * HAT_BROW_OFFSET;
  const centerY = hatBottomY - height / 2;
  const visibleWidth = Math.max(0, Math.min(bounds.x + bounds.width, previewSize.width) - Math.max(bounds.x, 0));
  const visibleHeight = Math.max(0, Math.min(bounds.y + bounds.height, previewSize.height) - Math.max(bounds.y, 0));
  const validBounds = bounds.width > 0 && bounds.height > 0;
  const sufficientlyInside = validBounds && visibleWidth * visibleHeight >= bounds.width * bounds.height * 0.15;
  const relativeWidth = headWidth / previewSize.width;
  const guidanceMessage = !sufficientlyInside ? 'Ubica tu cabeza dentro de la guía'
    : relativeWidth < 0.18 ? 'Acércate un poco'
      : relativeWidth > 0.62 ? 'Aléjate un poco' : 'Posición correcta';
  return {
    visible: sufficientlyInside,
    centerX,
    centerY,
    width,
    height,
    rotationDeg: Math.max(-30, Math.min(30, rotationDeg)),
    headWidth,
    hatBottomY,
    guidanceMessage,
  };
}
