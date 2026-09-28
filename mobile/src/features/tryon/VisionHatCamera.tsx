import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Camera, useCameraDevice, useCameraPermission, type CameraRef, type Constraint } from 'react-native-vision-camera';
import { transformFacesToPreviewCoordinates, useFaceDetectorOutput, type Face } from 'react-native-vision-camera-face-detector';

import { getHatPlacementFromFace, mappedFaceFromPreview, type CameraFacing, type Size } from './faceDetectorAdapter';

/* eslint-disable react-hooks/immutability -- Reanimated shared values are updated by native detector callbacks. */

type Props = { garmentImage?: string; onBackToPhoto?: () => void };
type DebugGeometry = {
  bounds: { x: number; y: number; width: number; height: number };
  leftEye?: { x: number; y: number };
  rightEye?: { x: number; y: number };
  leftEar?: { x: number; y: number };
  rightEar?: { x: number; y: number };
};
type DebugState = {
  callbacksPerSecond: number;
  debugUpdatesPerSecond: number;
  faceCount: number;
  faceDetected: boolean;
  faceWidth: number;
  earWidth: number;
  headWidth: number;
  hatWidth: number;
  hatBottomY: number;
  centerX: number;
  centerY: number;
  eyeAngle: number;
  frameSize: string;
  geometry?: DebugGeometry;
  guidance: string;
};
const EMPTY_DEBUG: DebugState = { callbacksPerSecond: 0, debugUpdatesPerSecond: 0, faceCount: 0, faceDetected: false, faceWidth: 0, earWidth: 0, headWidth: 0, hatWidth: 0, hatBottomY: 0, centerX: 0, centerY: 0, eyeAngle: 0, frameSize: '—', guidance: 'Ubica tu cabeza dentro de la guía' };
const CAMERA_CONSTRAINTS: Constraint[] = [{ fps: 30 }];
const SHOW_TRYON_DEBUG = __DEV__ && true;

export function VisionHatCamera({ garmentImage, onBackToPhoto }: Props) {
  const cameraRef = useRef<CameraRef>(null);
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>('front');
  const device = useCameraDevice(cameraFacing);
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  const [previewSize, setPreviewSize] = useState<Size | null>(null);
  const [imageAspect, setImageAspect] = useState(1 / 0.62);
  const [cameraError, setCameraError] = useState('');
  const [debug, setDebug] = useState<DebugState>(EMPTY_DEBUG);
  const callbackCounter = useRef({ startedAt: 0, count: 0, fps: 0 });
  const debugCounter = useRef({ startedAt: 0, count: 0, fps: 0 });
  const lastDebugAt = useRef(0);
  const missedCallbacks = useRef(0);
  const centerX = useSharedValue(0);
  const centerY = useSharedValue(0);
  const overlayWidth = useSharedValue(0);
  const overlayHeight = useSharedValue(0);
  const rotationDeg = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!hasPermission && canRequestPermission) void requestPermission();
  }, [canRequestPermission, hasPermission, requestPermission]);

  useEffect(() => {
    if (!garmentImage) return;
    Image.getSize(garmentImage, (width, height) => {
      if (width > 0 && height > 0) setImageAspect(width / height);
    });
  }, [garmentImage]);

  const hideAfterMisses = useCallback(() => {
    missedCallbacks.current += 1;
    if (missedCallbacks.current >= 3) {
      opacity.value = withTiming(0, { duration: 90 });
    }
  }, [opacity]);

  const handleFacesDetected = useCallback((faces: Face[]) => {
    const now = Date.now();
    const counter = callbackCounter.current;
    if (counter.startedAt === 0) counter.startedAt = now;
    counter.count += 1;
    const elapsed = now - counter.startedAt;
    if (elapsed >= 1000) {
      counter.fps = counter.count * 1000 / elapsed;
      counter.count = 0;
      counter.startedAt = now;
    }

    const previewFaces = cameraRef.current?.preview
      ? transformFacesToPreviewCoordinates(faces, cameraRef.current)
      : [];
    const face = previewFaces.reduce<Face | undefined>((largest, candidate) => {
      const area = candidate.bounds.width * candidate.bounds.height;
      return !largest || area > largest.bounds.width * largest.bounds.height ? candidate : largest;
    }, undefined);
    let nextDebug: DebugState = { ...EMPTY_DEBUG, callbacksPerSecond: counter.fps, faceCount: faces.length };

    if (!face || !previewSize) {
      hideAfterMisses();
    } else {
      const mapped = mappedFaceFromPreview(face);
        const placement = getHatPlacementFromFace(mapped, imageAspect, previewSize, 'live');
        nextDebug = {
          callbacksPerSecond: counter.fps,
          debugUpdatesPerSecond: debugCounter.current.fps,
          faceCount: faces.length,
          faceDetected: true,
          faceWidth: mapped.bounds.width,
          earWidth: placement.earWidth,
          headWidth: placement.headWidth,
          hatWidth: placement.width,
          hatBottomY: placement.hatBottomY,
          centerX: placement.centerX,
          centerY: placement.centerY,
          eyeAngle: placement.rotationDeg,
          frameSize: `${face.frameWidth}×${face.frameHeight}`,
          geometry: mapped,
          guidance: placement.guidanceMessage,
        };
        if (placement.visible && garmentImage) {
          missedCallbacks.current = 0;
          centerX.value = withTiming(placement.centerX, { duration: 75 });
          centerY.value = withTiming(placement.centerY, { duration: 75 });
          overlayWidth.value = withTiming(placement.width, { duration: 80 });
          overlayHeight.value = withTiming(placement.height, { duration: 80 });
          rotationDeg.value = withTiming(placement.rotationDeg, { duration: 75 });
          opacity.value = withTiming(1, { duration: 70 });
        } else hideAfterMisses();
    }

    if (now - lastDebugAt.current >= 500) {
      lastDebugAt.current = now;
      const debugStats = debugCounter.current;
      if (debugStats.startedAt === 0) debugStats.startedAt = now;
      debugStats.count += 1;
      const debugElapsed = now - debugStats.startedAt;
      if (debugElapsed >= 1000) {
        debugStats.fps = debugStats.count * 1000 / debugElapsed;
        debugStats.count = 0;
        debugStats.startedAt = now;
      }
      nextDebug.debugUpdatesPerSecond = debugStats.fps;
      setDebug(nextDebug);
      if (__DEV__) console.debug('[VisionHatCamera]', nextDebug);
    }
  }, [centerX, centerY, garmentImage, hideAfterMisses, imageAspect, opacity, overlayHeight, overlayWidth, previewSize, rotationDeg]);

  const faceDetectorOutput = useFaceDetectorOutput({
    onFacesDetected: handleFacesDetected,
    onError: (error) => setCameraError(error.message),
    performanceMode: 'fast',
    runLandmarks: true,
    runContours: false,
    runClassifications: false,
    trackingEnabled: true,
    cameraFacing,
    mirrorMode: cameraFacing === 'front' ? 'on' : 'off',
    autoMode: true,
    minFaceSize: 0.1,
  });

  const overlayStyle = useAnimatedStyle(() => ({
    left: centerX.value - overlayWidth.value / 2,
    top: centerY.value - overlayHeight.value / 2,
    width: overlayWidth.value,
    height: overlayHeight.value,
    opacity: opacity.value,
    transform: [{ rotate: `${rotationDeg.value}deg` }],
  }));

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) setPreviewSize({ width, height });
  };

  const switchCamera = () => {
    opacity.value = 0;
    missedCallbacks.current = 0;
    setCameraFacing((current) => current === 'front' ? 'back' : 'front');
  };

  if (!hasPermission) return <View style={styles.centered}>
    <Text style={styles.message}>Permite el acceso a la cámara para usar este modo.</Text>
    {canRequestPermission ? <Pressable style={styles.button} onPress={() => void requestPermission()}><Text style={styles.buttonText}>Permitir cámara</Text></Pressable> : null}
    {onBackToPhoto ? <Pressable style={styles.secondaryButton} onPress={onBackToPhoto}><Text style={styles.secondaryText}>Volver a Foto</Text></Pressable> : null}
  </View>;

  if (!device || cameraError) return <View style={styles.centered}>
    <Text style={styles.message}>{cameraError || 'No se encontró la cámara seleccionada.'}</Text>
    {onBackToPhoto ? <Pressable style={styles.secondaryButton} onPress={onBackToPhoto}><Text style={styles.secondaryText}>Volver a Foto</Text></Pressable> : null}
  </View>;

  return <View style={styles.wrapper}>
    <View style={styles.preview} onLayout={onLayout}>
      <Camera
        key={cameraFacing}
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
        constraints={CAMERA_CONSTRAINTS}
        mirrorMode={cameraFacing === 'front' ? 'on' : 'off'}
        resizeMode="cover"
        outputs={[faceDetectorOutput]}
        onError={(error) => setCameraError(error.message)}
      />
      {garmentImage ? <Animated.View pointerEvents="none" style={[styles.overlay, overlayStyle]}><Image source={{ uri: garmentImage }} resizeMode="contain" style={styles.garment} /></Animated.View> : null}
      {SHOW_TRYON_DEBUG ? <View pointerEvents="none" style={styles.debugPanel}>
        <Text style={styles.debugText}>Face width: {debug.faceWidth.toFixed(0)}</Text>
        <Text style={styles.debugText}>Ear width: {debug.earWidth.toFixed(0)}</Text>
        <Text style={styles.debugText}>Head width: {debug.headWidth.toFixed(0)}</Text>
        <Text style={styles.debugText}>Hat width: {debug.hatWidth.toFixed(0)}</Text>
      </View> : null}
      {SHOW_TRYON_DEBUG && debug.geometry ? <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.faceBounds, debug.geometry.bounds]} />
        {debug.geometry.leftEye ? <View style={[styles.eyePoint, { left: debug.geometry.leftEye.x - 3, top: debug.geometry.leftEye.y - 3 }]} /> : null}
        {debug.geometry.rightEye ? <View style={[styles.eyePoint, { left: debug.geometry.rightEye.x - 3, top: debug.geometry.rightEye.y - 3 }]} /> : null}
        {debug.geometry.leftEar ? <View style={[styles.earPoint, { left: debug.geometry.leftEar.x - 3, top: debug.geometry.leftEar.y - 3 }]} /> : null}
        {debug.geometry.rightEar ? <View style={[styles.earPoint, { left: debug.geometry.rightEar.x - 3, top: debug.geometry.rightEar.y - 3 }]} /> : null}
      </View> : null}
      <View pointerEvents="none" style={styles.guidance}><Text style={styles.guidanceText}>{debug.guidance}</Text></View>
    </View>
    <View style={styles.controls}>
      <Pressable style={styles.button} onPress={switchCamera}><Text style={styles.buttonText}>{cameraFacing === 'front' ? 'Cámara principal' : 'Cámara frontal'}</Text></Pressable>
      {onBackToPhoto ? <Pressable style={styles.secondaryButton} onPress={onBackToPhoto}><Text style={styles.secondaryText}>Volver a Foto</Text></Pressable> : null}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  wrapper: { marginTop: 12 },
  preview: { height: 480, overflow: 'hidden', borderRadius: 16, backgroundColor: '#020617' },
  overlay: { position: 'absolute' },
  garment: { width: '100%', height: '100%' },
  centered: { minHeight: 480, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, borderRadius: 16, backgroundColor: '#020617' },
  message: { color: 'white', textAlign: 'center' },
  controls: { marginTop: 12, flexDirection: 'row', justifyContent: 'center', gap: 10 },
  button: { borderRadius: 10, backgroundColor: '#be3f70', paddingHorizontal: 18, paddingVertical: 12 },
  buttonText: { color: 'white', fontWeight: '700' },
  secondaryButton: { borderRadius: 10, borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 18, paddingVertical: 12 },
  secondaryText: { color: '#475569', fontWeight: '700' },
  debugPanel: { position: 'absolute', top: 12, left: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,.75)', padding: 9 },
  debugText: { color: 'white', fontSize: 10, lineHeight: 14, textShadowColor: 'black', textShadowRadius: 2 },
  faceBounds: { position: 'absolute', borderWidth: 1, borderColor: '#22d3ee' },
  eyePoint: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: '#facc15' },
  earPoint: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ade80' },
  guidance: { position: 'absolute', left: 12, right: 12, bottom: 14, alignItems: 'center' },
  guidanceText: { overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,.75)', color: 'white', paddingHorizontal: 12, paddingVertical: 7, fontSize: 13, fontWeight: '600', textShadowColor: 'black', textShadowRadius: 2 },
});
