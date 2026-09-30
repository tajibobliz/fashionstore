import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useCameraPermission, type Constraint } from 'react-native-vision-camera';
import { usePoseLandmarkerOutput, type PosePoint, type PoseResult } from 'vision-camera-pose-landmarker';

type CameraFacing = 'front' | 'back';
type Size = { width: number; height: number };
type DebugState = {
  points: PosePoint[];
  frameSize: Size;
  callbacksPerSecond: number;
  inferenceTimeMs: number;
};

const TRACKED_LANDMARKS = [11, 12, 23, 24, 25, 26, 27, 28] as const;
const CAMERA_CONSTRAINTS: Constraint[] = [{ fps: 30 }];
const EMPTY_DEBUG: DebugState = {
  points: [], frameSize: { width: 0, height: 0 }, callbacksPerSecond: 0, inferenceTimeMs: 0,
};

export default function PoseNativeTestScreen() {
  const router = useRouter();
  const [facing, setFacing] = useState<CameraFacing>('front');
  const device = useCameraDevice(facing);
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  const [previewSize, setPreviewSize] = useState<Size>({ width: 0, height: 0 });
  const [debug, setDebug] = useState<DebugState>(EMPTY_DEBUG);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const callbackCounter = useRef({ startedAt: 0, count: 0, fps: 0 });

  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setAppActive(state === 'active'));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!hasPermission && canRequestPermission) void requestPermission();
  }, [canRequestPermission, hasPermission, requestPermission]);

  const onResults = useCallback((result: PoseResult) => {
    const now = Date.now();
    const counter = callbackCounter.current;
    if (!counter.startedAt) counter.startedAt = now;
    counter.count += 1;
    const elapsed = now - counter.startedAt;
    if (elapsed >= 1000) {
      counter.fps = counter.count * 1000 / elapsed;
      counter.count = 0;
      counter.startedAt = now;
    }
    const tracked = result.landmarks.filter(point => TRACKED_LANDMARKS.includes(point.index as typeof TRACKED_LANDMARKS[number]));
    setDebug({
      points: tracked,
      frameSize: { width: result.frameWidth, height: result.frameHeight },
      callbacksPerSecond: counter.fps,
      inferenceTimeMs: result.inferenceTimeMs,
    });
  }, []);
  const onDetectorError = useCallback((nativeError: Error) => setError(nativeError.message), []);

  const poseOutput = usePoseLandmarkerOutput({
    cameraFacing: facing,
    onResults,
    onError: onDetectorError,
  });

  const mappedPoints = useMemo(
    () => mapLandmarksToCover(debug.points, debug.frameSize, previewSize),
    [debug.frameSize, debug.points, previewSize],
  );
  const measurements = useMemo(() => measureBody(mappedPoints), [mappedPoints]);
  const cameraActive = focused && appActive;

  const onPreviewLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setPreviewSize({ width, height });
  };

  if (Platform.OS !== 'android') return <CenteredMessage message="Este prototipo temporal está disponible solo en Android." onBack={() => router.back()} />;
  if (!hasPermission) return <CenteredMessage message="Se necesita permiso de cámara para la prueba nativa." action={canRequestPermission ? () => void requestPermission() : undefined} onBack={() => router.back()} />;
  if (!device) return <CenteredMessage message="No se encontró la cámara seleccionada." onBack={() => router.back()} />;

  return <View style={styles.screen}>
    <View style={styles.preview} onLayout={onPreviewLayout}>
      <Camera
        key={facing}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={cameraActive}
        outputs={[poseOutput]}
        constraints={CAMERA_CONSTRAINTS}
        mirrorMode={facing === 'front' ? 'on' : 'off'}
        resizeMode="cover"
        onError={cameraError => setError(cameraError.message)}
      />
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {mappedPoints.filter(point => point.visibility >= 0.4).map(point => <View key={point.index} style={[styles.point, { left: point.x - 5, top: point.y - 5 }]}>
          <Text style={styles.pointLabel}>{point.index}</Text>
        </View>)}
      </View>
      <SafeAreaView pointerEvents="box-none" style={styles.safeArea}>
        <View pointerEvents="none" style={styles.debugPanel}>
          <Text style={styles.title}>Pose Landmarker nativo · LIVE_STREAM</Text>
          <Text style={styles.metric}>Callbacks reales: {debug.callbacksPerSecond.toFixed(1)} FPS</Text>
          <Text style={styles.metric}>Inferencia: {debug.inferenceTimeMs.toFixed(0)} ms</Text>
          <Text style={styles.metric}>Hombros: {formatPixels(measurements.shoulderWidth)}</Text>
          <Text style={styles.metric}>Caderas: {formatPixels(measurements.hipWidth)}</Text>
          <Text style={styles.metric}>Hombros → caderas: {formatPixels(measurements.torsoHeight)}</Text>
          <Text style={styles.metric}>Landmarks visibles: {mappedPoints.filter(point => point.visibility >= 0.4).length}/8</Text>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.controls}>
          <Pressable style={styles.secondaryButton} onPress={() => router.back()}><Text style={styles.buttonText}>Salir</Text></Pressable>
          <Pressable style={styles.primaryButton} onPress={() => {
            setDebug(EMPTY_DEBUG);
            callbackCounter.current = { startedAt: 0, count: 0, fps: 0 };
            setFacing(current => current === 'front' ? 'back' : 'front');
          }}><Text style={styles.buttonText}>{facing === 'front' ? 'Cámara principal' : 'Cámara frontal'}</Text></Pressable>
        </View>
      </SafeAreaView>
    </View>
  </View>;
}

type MappedPoint = PosePoint & { x: number; y: number };

function mapLandmarksToCover(points: PosePoint[], frame: Size, preview: Size): MappedPoint[] {
  if (!frame.width || !frame.height || !preview.width || !preview.height) return [];
  const scale = Math.max(preview.width / frame.width, preview.height / frame.height);
  const renderedWidth = frame.width * scale;
  const renderedHeight = frame.height * scale;
  const cropX = (renderedWidth - preview.width) / 2;
  const cropY = (renderedHeight - preview.height) / 2;
  return points.map(point => ({
    ...point,
    x: point.x * renderedWidth - cropX,
    y: point.y * renderedHeight - cropY,
  }));
}

function measureBody(points: MappedPoint[]) {
  const byIndex = new Map(points.filter(point => point.visibility >= 0.4).map(point => [point.index, point]));
  const distance = (left?: MappedPoint, right?: MappedPoint) => left && right ? Math.hypot(right.x - left.x, right.y - left.y) : null;
  const leftShoulder = byIndex.get(11); const rightShoulder = byIndex.get(12);
  const leftHip = byIndex.get(23); const rightHip = byIndex.get(24);
  const shoulderCenter = leftShoulder && rightShoulder ? midpoint(leftShoulder, rightShoulder) : undefined;
  const hipCenter = leftHip && rightHip ? midpoint(leftHip, rightHip) : undefined;
  return {
    shoulderWidth: distance(leftShoulder, rightShoulder),
    hipWidth: distance(leftHip, rightHip),
    torsoHeight: distance(shoulderCenter, hipCenter),
  };
}

function midpoint(a: MappedPoint, b: MappedPoint): MappedPoint {
  return { ...a, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
function formatPixels(value: number | null) { return value === null ? '—' : `${value.toFixed(0)} px`; }

function CenteredMessage({ message, action, onBack }: { message: string; action?: () => void; onBack: () => void }) {
  return <SafeAreaView style={styles.centered}>
    <Text style={styles.centeredText}>{message}</Text>
    {action ? <Pressable style={styles.primaryButton} onPress={action}><Text style={styles.buttonText}>Permitir cámara</Text></Pressable> : null}
    <Pressable style={styles.secondaryButton} onPress={onBack}><Text style={styles.buttonText}>Volver</Text></Pressable>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#020617' },
  preview: { flex: 1, overflow: 'hidden', backgroundColor: '#020617' },
  safeArea: { flex: 1, justifyContent: 'space-between', padding: 14 },
  debugPanel: { alignSelf: 'flex-start', gap: 3, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,.55)', backgroundColor: 'rgba(2,6,23,.72)', padding: 12 },
  title: { marginBottom: 4, color: '#67e8f9', fontSize: 13, fontWeight: '800' },
  metric: { color: 'white', fontSize: 12, fontVariant: ['tabular-nums'] },
  point: { position: 'absolute', width: 10, height: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 5, borderWidth: 2, borderColor: 'white', backgroundColor: '#f43f5e' },
  pointLabel: { position: 'absolute', top: 9, minWidth: 24, color: 'white', fontSize: 9, fontWeight: '800', textAlign: 'center', textShadowColor: 'black', textShadowRadius: 3 },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  primaryButton: { borderRadius: 11, backgroundColor: '#be3f70', paddingHorizontal: 18, paddingVertical: 12 },
  secondaryButton: { borderRadius: 11, borderWidth: 1, borderColor: 'rgba(255,255,255,.7)', backgroundColor: 'rgba(2,6,23,.65)', paddingHorizontal: 18, paddingVertical: 12 },
  buttonText: { color: 'white', fontWeight: '800' },
  error: { alignSelf: 'center', borderRadius: 10, backgroundColor: 'rgba(127,29,29,.85)', color: 'white', padding: 10 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: '#020617', padding: 24 },
  centeredText: { color: 'white', textAlign: 'center', fontSize: 16 },
});
