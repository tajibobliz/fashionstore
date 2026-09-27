import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { WebView } from 'react-native-webview';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

/* eslint-disable react-hooks/immutability -- Reanimated shared values are intentionally updated by fit and gesture controls. */

import { Button } from '@/components/ui/Button';
import { AuthenticatedHeader } from '@/components/layout/AuthenticatedHeader';
import { arService } from '@/services/ar.service';
import { catalogService } from '@/services/catalog.service';
import { resolveImageUrl } from '@/services/imageUrl.service';
import type { Producto, VarianteProducto } from '@/types/catalog.types';
import { getGarmentPlacement, getHatOverlayFromPose, smoothPlacement, type Landmark, type Placement } from '@/features/tryon/strategies';

type GarmentZone = NonNullable<Producto['tipoPrendaVestidor']>;

type PoseLandmark = {
  x: number;
  y: number;
  visibility?: number;
};

type PreviewSize = {
  width: number;
  height: number;
};

type LivePoseState = 'SEARCHING' | 'TOO_FAR' | 'TOO_CLOSE' | 'OFF_CENTER' | 'READY' | 'FAILED';

const LIVE_POSE_MESSAGE: Record<LivePoseState, string> = {
  SEARCHING: 'Colócate frente a la cámara',
  TOO_FAR: 'Acércate un poco',
  TOO_CLOSE: 'Aléjate un poco',
  OFF_CENTER: 'Centra tu cuerpo',
  READY: 'Posición correcta',
  FAILED: 'No pudimos detectar tu posición',
};

const transparentImageExtension = /\.(png|webp)(?:[?#].*)?$/i;
const modelExtension = /\.(glb|gltf)(\?.*)?$/i;

function isTransparentImageUrl(value?: string | null) {
  return Boolean(value && (value.startsWith('data:image/png;') || value.startsWith('data:image/webp;') || transparentImageExtension.test(value)));
}

function resolveTryOnImage(product: Producto, selectedVariant?: VarianteProducto) {
  const candidates = [selectedVariant?.imagenVestidorUrl, product.imagenVestidorUrl, product.imagenTryOn];
  return candidates.find((url) => isTransparentImageUrl(url)) ?? null;
}

function resolveGarmentZone(type?: GarmentZone | null): GarmentZone {
  return type ?? 'OTRO';
}

function isVisible(point?: PoseLandmark) {
  return Boolean(point && (point.visibility === undefined || point.visibility >= 0.35));
}

function midpoint(left: PoseLandmark, right: PoseLandmark): PoseLandmark {
  return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
}

function distance(first: PoseLandmark, second: PoseLandmark) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function assessLivePose(landmarks: PoseLandmark[], zone: GarmentZone): LivePoseState {
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  if (zone === 'GORRA') {
    const hat = getHatOverlayFromPose({ landmarks, width: 1, height: 1, imageAspect: 1, live: true });
    if (hat.guidanceMessage === 'Acércate un poco') return 'TOO_FAR';
    if (hat.guidanceMessage === 'Aléjate un poco') return 'TOO_CLOSE';
    return hat.visible ? 'READY' : 'SEARCHING';
  } else if (zone === 'CAMISA' || zone === 'BLUSA' || zone === 'TOP' || zone === 'OTRO') {
    if (![leftShoulder, rightShoulder, leftHip, rightHip].every(isVisible)) return 'SEARCHING';
  } else if (zone === 'VESTIDO') {
    if (![leftShoulder, rightShoulder, landmarks[25], landmarks[26]].every(isVisible)) return 'SEARCHING';
  } else if (zone === 'FALDA') {
    if (![leftHip, rightHip, landmarks[25], landmarks[26]].every(isVisible)) return 'SEARCHING';
  } else if (zone === 'PANTALON') {
    if (![leftHip, rightHip, landmarks[27], landmarks[28]].every(isVisible)) return 'SEARCHING';
  } else if (zone === 'CARTERA' && ![leftHip, rightHip].every(isVisible)) return 'SEARCHING';

  const shoulderCenter = isVisible(leftShoulder) && isVisible(rightShoulder) ? midpoint(leftShoulder, rightShoulder) : midpoint(landmarks[7], landmarks[8]);
  const hipCenter = isVisible(leftHip) && isVisible(rightHip) ? midpoint(leftHip, rightHip) : shoulderCenter;
  const torsoHeight = Math.abs(hipCenter.y - shoulderCenter.y);
  const shoulderWidth = distance(leftShoulder, rightShoulder);
  const bodyCenterX = (shoulderCenter.x + hipCenter.x) / 2;

  if (torsoHeight < 0.16 || shoulderWidth < 0.16) return 'TOO_FAR';
  if (torsoHeight > 0.48 || shoulderWidth > 0.62) return 'TOO_CLOSE';
  if (Math.abs(bodyCenterX - 0.5) > 0.16) return 'OFF_CENTER';
  return 'READY';
}

function buildPoseHtml(photoDataUri: string) {
  const imageSource = JSON.stringify(photoDataUri);

  return `<!doctype html>
<html>
  <head><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body>
    <script src="https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js"></script>
    <script>
      let completed = false;
      const report = (message) => {
        if (!completed) {
          completed = true;
          window.ReactNativeWebView.postMessage(JSON.stringify(message));
        }
      };

      try {
        const pose = new Pose({
          locateFile: (file) => 'https://cdn.jsdelivr.net/npm/@mediapipe/pose/' + file,
        });
        pose.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        pose.onResults((results) => {
          if (results.poseLandmarks && results.poseLandmarks.length) {
            report({ type: 'POSE', landmarks: results.poseLandmarks });
          } else {
            report({ type: 'FAILED' });
          }
        });

        const image = new Image();
        image.onload = () => pose.send({ image }).catch(() => report({ type: 'FAILED' }));
        image.onerror = () => report({ type: 'FAILED' });
        image.src = ${imageSource};
        setTimeout(() => report({ type: 'FAILED' }), 12000);
      } catch (_) {
        report({ type: 'FAILED' });
      }
    </script>
  </body>
</html>`;
}

export default function VirtualFittingScreen() {
  const { id, idVariante } = useLocalSearchParams<{ id: string; idVariante?: string }>();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [product, setProduct] = useState<Producto | null>(null);
  const [resolvedGarment, setResolvedGarment] = useState<{ source: string; url: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'photo' | 'live' | 'model'>('photo');
  const [selectedVariantId, setSelectedVariantId] = useState<number | undefined>(Number(idVariante) || undefined);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const openLiveCamera = async () => {
    setCameraError(null);
    setCameraReady(false);
    try {
      const permission = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
      if (!permission.granted) {
        setCameraError('Permite el acceso a la cámara para usar este modo. Puedes continuar con Foto.');
        setMode('photo');
        return;
      }
      setMode('live');
    } catch {
      setCameraError('No se pudo acceder a la cámara. Puedes continuar con Foto.');
      setMode('photo');
    }
  };

  useEffect(() => {
    let mounted = true;

    catalogService
      .getProductoById(Number(id))
      .then((response) => {
        if (!mounted) return;
        setProduct(response);
        void arService.registrarInteraccion(Number(id), 'PRUEBA_VIRTUAL').catch(() => undefined);
      })
      .catch(() => {
        if (mounted) Alert.alert('No pudimos abrir el vestidor', 'Intenta nuevamente desde el producto.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id]);

  const selectedVariant = useMemo(() => {
    if (!product?.variantes?.length) return undefined;
    const variantId = selectedVariantId ?? Number(idVariante);
    return product.variantes.find((variant) => variant.idVariante === variantId)
      ?? product.variantes.find((variant) => resolveTryOnImage(product, variant))
      ?? product.variantes[0];
  }, [idVariante, product, selectedVariantId]);
  const garmentImage = useMemo(() => product ? resolveTryOnImage(product, selectedVariant) : null, [product, selectedVariant]);
  const resolvedGarmentImage = resolvedGarment?.source === garmentImage ? resolvedGarment.url : null;

  useEffect(() => {
    let active = true;
    if (garmentImage) {
      void resolveImageUrl(garmentImage).then((url) => { if (active) setResolvedGarment({ source: garmentImage, url }); });
    }
    return () => { active = false; };
  }, [garmentImage]);

  const modelUrl = product?.recursoRaUrl && modelExtension.test(product.recursoRaUrl) ? product.recursoRaUrl : null;

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#be3d6d" />
      </SafeAreaView>
    );
  }

  if (product && garmentImage && !resolvedGarmentImage) {
    return <SafeAreaView className="flex-1 items-center justify-center bg-white"><ActivityIndicator color="#be3d6d" /></SafeAreaView>;
  }

  if (!product || !garmentImage || !resolvedGarmentImage) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-center text-lg font-semibold text-slate-900">No hay un overlay válido para el vestidor. Se requiere una URL PNG o WebP; no se usa la imagen de catálogo.</Text>
        <View className="mt-5 w-full"><Button title="Volver al producto" onPress={() => router.back()} /></View>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <AuthenticatedHeader title="Vestidor virtual" />
      <ScrollView contentContainerClassName="px-4 pb-8" showsVerticalScrollIndicator={false}>
        <Text className="mt-3 text-center text-sm font-medium text-slate-600">{product.nombre}</Text>

        {product.variantes?.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2" contentContainerClassName="gap-2">
            {product.variantes.map((variant) => {
              const active = variant.idVariante === selectedVariant?.idVariante;
              const label = [variant.talla?.nombre, variant.color?.nombre].filter(Boolean).join(' · ') || variant.sku;
              return <Pressable key={variant.idVariante} onPress={() => setSelectedVariantId(variant.idVariante)} className={`rounded-full px-3 py-2 ${active ? 'bg-rose-100' : 'bg-slate-100'}`}><Text className={`text-xs ${active ? 'font-semibold text-rose-700' : 'text-slate-600'}`}>{label}</Text></Pressable>;
            })}
          </ScrollView>
        ) : null}

        <View className="mt-3 flex-row rounded-xl bg-rose-50 p-1">
          <Pressable
            onPress={() => setMode('photo')}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === 'photo' }}
            className={`flex-1 rounded-lg px-3 py-2 ${mode === 'photo' ? 'bg-white' : ''}`}
          >
            <Text className={`text-center font-semibold ${mode === 'photo' ? 'text-rose-700' : 'text-slate-600'}`}>Foto</Text>
          </Pressable>
          <Pressable
            onPress={() => void openLiveCamera()}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === 'live' }}
            className={`flex-1 rounded-lg px-3 py-2 ${mode === 'live' ? 'bg-white' : ''}`}
          >
            <Text className={`text-center font-semibold ${mode === 'live' ? 'text-rose-700' : 'text-slate-600'}`}>Cámara en vivo</Text>
          </Pressable>
        </View>

        {modelUrl && Platform.OS !== 'web' ? (
          <Pressable onPress={() => setMode(mode === 'model' ? 'photo' : 'model')} className="mt-2 self-end px-2 py-1">
            <Text className="text-xs font-medium text-slate-500">{mode === 'model' ? 'Volver al probador 2D' : 'Ver modelo 3D'}</Text>
          </Pressable>
        ) : null}

        {mode === 'model' && modelUrl ? (
          <ModelViewer modelUrl={modelUrl} />
        ) : (
          <PhotoFitting
            garmentImage={resolvedGarmentImage}
            garmentType={product.tipoPrendaVestidor}
            mode={mode === 'live' ? 'live' : 'photo'}
            onModeChange={(fittingMode) => setMode(fittingMode)}
            cameraPermission={cameraPermission}
            cameraError={cameraError}
            onCameraError={setCameraError}
            cameraReady={cameraReady}
            setCameraReady={setCameraReady}
          />
        )}
      </ScrollView>
    </View>
  );
}

function PhotoFitting({
  garmentImage,
  garmentType,
  mode,
  onModeChange,
  cameraPermission,
  cameraError,
  onCameraError,
  cameraReady,
  setCameraReady,
}: {
  garmentImage: string;
  garmentType?: GarmentZone | null;
  mode: 'photo' | 'live';
  onModeChange: (mode: 'photo' | 'live') => void;
  cameraPermission: { granted: boolean } | null;
  cameraError: string | null;
  onCameraError: (message: string | null) => void;
  cameraReady: boolean;
  setCameraReady: (ready: boolean) => void;
}) {
  const cameraRef = useRef<CameraView>(null);
  const previewRef = useRef<View>(null);
  const [showGuide, setShowGuide] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('front');
  const [frozenUri, setFrozenUri] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoDataUri, setPhotoDataUri] = useState<string | null>(null);
  const [photoSize, setPhotoSize] = useState<PreviewSize | null>(null);
  const [previewSize, setPreviewSize] = useState<PreviewSize | null>(null);
  const [poseLandmarks, setPoseLandmarks] = useState<PoseLandmark[] | null>(null);
  const [poseStatus, setPoseStatus] = useState<'idle' | 'detecting' | 'adjusted' | 'failed'>('idle');
  const [analysisAttempt, setAnalysisAttempt] = useState(0);
  const [livePoseStatus, setLivePoseStatus] = useState<LivePoseState>('SEARCHING');
  const [liveGuidanceMessage, setLiveGuidanceMessage] = useState('Ubica tu cabeza dentro de la guía');
  const [hatDebug, setHatDebug] = useState({ detected: false, headWidth: 0 });
  const [liveFrameDataUri, setLiveFrameDataUri] = useState<string | null>(null);
  const [liveAnalysisAttempt, setLiveAnalysisAttempt] = useState(0);
  const [liveAnalysisProcessing, setLiveAnalysisProcessing] = useState(false);
  const [manualAdjustment, setManualAdjustment] = useState(false);
  const [garmentAspect, setGarmentAspect] = useState<number | null>(null);
  const [autoPlacement, setAutoPlacement] = useState<Placement | null>(null);
  const previousPlacement = useRef<Placement | null>(null);
  const appliedAttempt = useRef(0);
  const liveAnalysisBusy = useRef(false);
  const liveCaptureRequested = useRef(false);
  const latestLiveLandmarks = useRef<PoseLandmark[] | null>(null);
  const latestLiveFrameSize = useRef<PreviewSize | null>(null);
  const missedHatFrames = useRef(0);
  const zone = useMemo(() => resolveGarmentZone(garmentType), [garmentType]);
  const detectorAvailable = Platform.OS !== 'web';

  useEffect(() => {
    let active = true;
    Image.getSize(garmentImage, (width, height) => {
      if (active && width > 0 && height > 0) setGarmentAspect(width / height);
    }, () => { if (active) setGarmentAspect(null); });
    return () => { active = false; };
  }, [garmentImage]);



  const freezeLivePreview = async () => {
    if (!cameraRef.current || !cameraReady || capturing || liveAnalysisBusy.current || frozenUri) return;
    setCapturing(true);
    liveCaptureRequested.current = true;
    try {
      const capture = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      setFrozenUri(capture.uri);
      setManualAdjustment(false);
    } catch (error) {
      onCameraError(error instanceof Error ? error.message : 'No se pudo congelar la imagen.');
    } finally {
      setCapturing(false);
      liveCaptureRequested.current = false;
    }
  };

  const saveFrozenPreview = async () => {
    if (!frozenUri || !previewRef.current) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permiso necesario', 'Permite guardar imágenes en tu galería.');
        return;
      }
      // Native modules absent from Expo Go must not be loaded while the route initializes.
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- Defer native module resolution to the save action.
      const MediaLibrary = require('expo-media-library') as typeof import('expo-media-library');
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- Defer native module resolution to the save action.
      const { captureRef } = require('react-native-view-shot') as typeof import('react-native-view-shot');
      const compositeUri = await captureRef(previewRef, { format: 'jpg', quality: 0.95, result: 'tmpfile' });
      await MediaLibrary.saveToLibraryAsync(compositeUri);
      Alert.alert('Captura guardada', 'La imagen con la prenda superpuesta está en tu galería.');
    } catch {
      Alert.alert('No se pudo guardar', 'El cliente actual no incluye captura nativa de vistas. Usa un development build actualizado y vuelve a intentar.');
    }
  };

  const discardFrozenPreview = () => {
    setFrozenUri(null);
    setManualAdjustment(false);
    latestLiveLandmarks.current = null;
    missedHatFrames.current = 0;
    setLiveGuidanceMessage('Ubica tu cabeza dentro de la guía');
    setLivePoseStatus('SEARCHING');
  };

  const changeCameraFacing = () => {
    setCameraReady(false);
    setCameraFacing((current) => current === 'front' ? 'back' : 'front');
    latestLiveLandmarks.current = null;
    missedHatFrames.current = 0;
    setLiveGuidanceMessage('Ubica tu cabeza dentro de la guía');
    setLivePoseStatus('SEARCHING');
    setManualAdjustment(false);
  };

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startRotation = useSharedValue(0);

  const garmentStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotation.value}rad` },
      { scale: scale.value },
    ],
  }));

  const resetGarment = useCallback(() => {
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    scale.value = withSpring(1);
    rotation.value = withSpring(0);
    setManualAdjustment(false);
    previousPlacement.current = null;
  }, [rotation, scale, translateX, translateY]);

  const processPickedAsset = useCallback((asset: ImagePicker.ImagePickerAsset) => {
    setPhotoUri(asset.uri);
    setPhotoSize(asset.width > 0 && asset.height > 0 ? { width: asset.width, height: asset.height } : null);
    setManualAdjustment(false);
    setAutoPlacement(null);
    previousPlacement.current = null;
    setPoseLandmarks(null);
    appliedAttempt.current = 0;
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    scale.value = withSpring(1);
    rotation.value = withSpring(0);

    if (!asset.base64) {
      setPhotoDataUri(null);
      setPoseStatus('failed');
      return;
    }

    setPhotoDataUri(`data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`);
    if (detectorAvailable) {
      setPoseStatus('detecting');
      setAnalysisAttempt((current) => current + 1);
    } else {
      setPoseStatus('idle');
    }
  }, [detectorAvailable, rotation, scale, translateX, translateY]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let mounted = true;

    void ImagePicker.getPendingResultAsync().then((pending) => {
      if (!mounted || !pending) return;
      if ('code' in pending) {
        setPoseStatus('failed');
        return;
      }
      if (!pending.canceled && pending.assets[0]) processPickedAsset(pending.assets[0]);
    }).catch(() => {
      if (mounted) setPoseStatus('failed');
    });

    return () => { mounted = false; };
  }, [processPickedAsset]);

  const applyAutoFit = useCallback((
    landmarks = poseLandmarks,
    sourceSize = photoSize,
    mirrorX = false,
    updateStatus = true,
    smooth = false,
    liveHat = false,
  ) => {
    if (!landmarks || !sourceSize || !previewSize || !garmentAspect) return false;
    const coverScale = Math.max(previewSize.width / sourceSize.width, previewSize.height / sourceSize.height);
    const renderedWidth = sourceSize.width * coverScale;
    const renderedHeight = sourceSize.height * coverScale;
    const offsetX = (previewSize.width - renderedWidth) / 2;
    const offsetY = (previewSize.height - renderedHeight) / 2;
    const viewportLandmarks: Landmark[] = landmarks.map((point) => ({
      x: (offsetX + point.x * renderedWidth) / previewSize.width,
      y: (offsetY + point.y * renderedHeight) / previewSize.height,
      visibility: point.visibility,
    }));
    const placementInput = { landmarks: viewportLandmarks, width: previewSize.width, height: previewSize.height, imageAspect: garmentAspect, mirrored: mirrorX };
    const hat = zone === 'GORRA' && liveHat ? getHatOverlayFromPose({ ...placementInput, live: true }) : null;
    const next = hat
      ? hat.visible ? { cx: hat.centerX, cy: hat.centerY, width: hat.width, height: hat.height, angle: hat.rotationDeg * Math.PI / 180 } : null
      : getGarmentPlacement(zone, placementInput);
    if (!next) {
      setAutoPlacement(null);
      previousPlacement.current = null;
      return false;
    }
    const placement = smooth ? smoothPlacement(previousPlacement.current, next) : next;
    previousPlacement.current = placement;
    setAutoPlacement(placement);
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    scale.value = withSpring(1);
    rotation.value = withSpring(placement.angle);
    if (updateStatus) setPoseStatus('adjusted');
    return true;
  }, [photoSize, poseLandmarks, previewSize, garmentAspect, rotation, scale, translateX, translateY, zone]);

  useEffect(() => {
    if (!poseLandmarks || analysisAttempt === 0 || appliedAttempt.current === analysisAttempt) return;
    if (!photoSize || !previewSize) return;
    appliedAttempt.current = analysisAttempt;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- MediaPipe returns asynchronously; this applies its fit and status together.
    if (!applyAutoFit()) setPoseStatus('failed');
  }, [analysisAttempt, applyAutoFit, photoSize, poseLandmarks, previewSize]);

  useEffect(() => {
    if (poseStatus !== 'detecting') return;
    const timeout = setTimeout(() => setPoseStatus('failed'), 15000);
    return () => clearTimeout(timeout);
  }, [poseStatus]);

  const choosePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permiso necesario', 'Activa el permiso de galería para subir una imagen.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, base64: true });

    if (result.canceled || !result.assets[0]) return;
    processPickedAsset(result.assets[0]);
  };

  const onPreviewLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) setPreviewSize({ width, height });
  };

  const rerunAutoFit = () => {
    if (!photoDataUri || !detectorAvailable) return;
    appliedAttempt.current = 0;
    setManualAdjustment(false);
    setPoseLandmarks(null);
    setPoseStatus('detecting');
    setAnalysisAttempt((current) => current + 1);
  };

  useEffect(() => {
    if (mode !== 'live' || !cameraReady || !cameraPermission?.granted || frozenUri) {
      liveAnalysisBusy.current = false;
      liveCaptureRequested.current = false;
      return;
    }

    let active = true;
    const analyzeFrame = async () => {
      if (!active || liveAnalysisBusy.current || liveCaptureRequested.current || !cameraRef.current) return;
      liveAnalysisBusy.current = true;
      setLiveAnalysisProcessing(true);
      try {
        const frame = await cameraRef.current.takePictureAsync({ quality: zone === 'GORRA' ? 0.18 : 0.25, base64: true });
        if (!active) return;
        if (!frame.base64) throw new Error('Camera frame has no base64 data');
        const frameSize = { width: frame.width, height: frame.height };
        latestLiveFrameSize.current = frameSize;
        setLiveFrameDataUri(`data:image/jpeg;base64,${frame.base64}`);
        setLiveAnalysisAttempt((attempt) => attempt + 1);
      } catch {
        if (!active) return;
        liveAnalysisBusy.current = false;
        setLiveAnalysisProcessing(false);
        setLivePoseStatus('FAILED');
      }
    };

    void analyzeFrame();
    const timer = setInterval(() => void analyzeFrame(), zone === 'GORRA' ? 900 : 1800);
    return () => {
      active = false;
      clearInterval(timer);
      liveAnalysisBusy.current = false;
      liveCaptureRequested.current = false;
    };
  }, [cameraPermission?.granted, cameraReady, frozenUri, mode, zone]);

  const finishLiveAnalysis = (landmarks: PoseLandmark[] | null) => {
    liveAnalysisBusy.current = false;
    setLiveAnalysisProcessing(false);
    if (mode !== 'live') return;
    if (!landmarks) {
      if (zone === 'GORRA' && previousPlacement.current && missedHatFrames.current < 1) {
        missedHatFrames.current += 1;
        setHatDebug((current) => ({ ...current, detected: false }));
        setLiveGuidanceMessage('Ubica tu cabeza dentro de la guía');
        return;
      }
      missedHatFrames.current = 0;
      setHatDebug({ detected: false, headWidth: 0 });
      setLiveGuidanceMessage('Ubica tu cabeza dentro de la guía');
      setLivePoseStatus('FAILED');
      return;
    }

    latestLiveLandmarks.current = landmarks;
    const sourceSize = latestLiveFrameSize.current;
    if (zone === 'GORRA' && sourceSize) {
      const hat = getHatOverlayFromPose({ landmarks, width: sourceSize.width, height: sourceSize.height, imageAspect: garmentAspect ?? 1, mirrored: cameraFacing === 'front', live: true });
      const estimatedHeadWidth = hat.width > 0 ? hat.width / 1.28 : 0;
      setHatDebug({ detected: hat.width > 0, headWidth: estimatedHeadWidth });
      setLiveGuidanceMessage(hat.guidanceMessage);
      if (!hat.visible) {
        missedHatFrames.current = 0;
        setLivePoseStatus(hat.guidanceMessage === 'Acércate un poco' ? 'TOO_FAR' : hat.guidanceMessage === 'Aléjate un poco' ? 'TOO_CLOSE' : 'SEARCHING');
        return;
      }
      missedHatFrames.current = 0;
    }
    const nextStatus = assessLivePose(landmarks, zone);
    setLivePoseStatus(nextStatus);
    if (nextStatus === 'READY' && !manualAdjustment) {
      if (!sourceSize || !applyAutoFit(landmarks, sourceSize, cameraFacing === 'front', false, true, zone === 'GORRA')) {
        setLivePoseStatus('SEARCHING');
      }
    }
  };

  const markManualAdjustment = useCallback(() => {
    if (mode === 'live') setManualAdjustment(true);
  }, [mode]);

  const pan = Gesture.Pan()
    .onBegin(() => {
      runOnJS(markManualAdjustment)();
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = startX.value + event.translationX;
      translateY.value = startY.value + event.translationY;
    });
  const pinch = Gesture.Pinch()
    .onBegin(() => { runOnJS(markManualAdjustment)(); startScale.value = scale.value; })
    .onUpdate((event) => { scale.value = Math.min(3, Math.max(0.25, startScale.value * event.scale)); });
  const rotate = Gesture.Rotation()
    .onBegin(() => { runOnJS(markManualAdjustment)(); startRotation.value = rotation.value; })
    .onUpdate((event) => { rotation.value = startRotation.value + event.rotation; });
  const gesture = Gesture.Simultaneous(pan, pinch, rotate);

  return (
    <View className="mt-3">
      {cameraError ? <Text accessibilityRole="alert" className="mb-2 text-center text-xs text-amber-700">{cameraError}</Text> : null}

      <View ref={previewRef} collapsable={false} onLayout={onPreviewLayout} className="relative h-[480px] overflow-hidden rounded-2xl bg-slate-950">
        {mode === 'live' && frozenUri ? (
          <Image
            source={{ uri: frozenUri }}
            resizeMode="cover"
            style={[StyleSheet.absoluteFill, { transform: [{ scaleX: cameraFacing === 'front' ? -1 : 1 }] }]}
          />
        ) : mode === 'live' && cameraPermission?.granted && !cameraError ? (
          <CameraView
            key={cameraFacing}
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={cameraFacing}
            mirror={cameraFacing === 'front'}
            onCameraReady={() => setCameraReady(true)}
            onMountError={(event) => {
              onCameraError('No se pudo iniciar la cámara. Puedes continuar con Foto.');
              setCameraReady(false);
              onModeChange('photo');
            }}
          />
        ) : mode === 'photo' && photoUri ? (
          <Image source={{ uri: photoUri }} resizeMode="cover" style={StyleSheet.absoluteFill} />
        ) : (
          <View className="flex-1 items-center justify-center bg-rose-50 px-8">
            <Text className="text-center text-sm text-slate-600">{mode === 'live' ? cameraError ?? 'Solicitando permiso de cámara…' : 'Elige una foto para colocar la prenda.'}</Text>
          </View>
        )}

        {mode === 'live' && !frozenUri && cameraPermission?.granted && cameraReady && showGuide ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <View className="absolute left-[20%] top-[24%] h-[42%] w-[60%] rounded-[45%] border border-white/30" />
            <View className="absolute left-[27%] top-[29%] h-px w-[46%] bg-white/45" />
          </View>
        ) : null}

        {mode === 'live' && zone === 'GORRA' ? (
          <View pointerEvents="none" className="absolute left-2 top-2 rounded-lg bg-black/60 px-2 py-1">
            <Text className="text-[10px] text-white">Tipo: GORRA</Text>
            <Text className="text-[10px] text-white">Cabeza: {hatDebug.detected ? 'sí' : 'no'}</Text>
            <Text className="text-[10px] text-white">Ancho: {Math.round(hatDebug.headWidth)} px</Text>
            <Text className="text-[10px] text-white">{liveGuidanceMessage}</Text>
          </View>
        ) : null}

        {(mode === 'live' && cameraPermission?.granted && cameraReady && livePoseStatus === 'READY' || mode === 'photo' && photoUri && autoPlacement) && autoPlacement ? (
          <GestureDetector gesture={gesture}>
            <Animated.View
              style={[{
                position: 'absolute',
                left: autoPlacement.cx - autoPlacement.width / 2,
                top: autoPlacement.cy - autoPlacement.height / 2,
                width: autoPlacement.width,
                height: autoPlacement.height,
              }, garmentStyle]}
            >
              <Image source={{ uri: garmentImage }} resizeMode="contain" className="h-full w-full" />
            </Animated.View>
          </GestureDetector>
        ) : null}

        {mode === 'live' && cameraPermission?.granted && !cameraReady && !cameraError ? (
          <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
            <ActivityIndicator color="white" />
          </View>
        ) : null}
      </View>

      {mode === 'live' ? (
        <View className="mt-3 flex-row flex-wrap items-center justify-center gap-2">
          {!frozenUri ? (
            <>
              <View className="w-28"><Button title={capturing ? 'Congelando…' : 'Congelar'} compact onPress={() => void freezeLivePreview()} disabled={!cameraReady || capturing || liveAnalysisProcessing} /></View>
              <View className="w-36"><Button title={cameraFacing === 'front' ? 'Cámara principal' : 'Cámara frontal'} compact variant="secondary" onPress={changeCameraFacing} disabled={!cameraReady || capturing} /></View>
              <Pressable onPress={() => setShowGuide((visible) => !visible)} className="rounded-lg px-2 py-2">
                <Text className="text-xs font-medium text-slate-600">{showGuide ? 'Ocultar guía' : 'Mostrar guía'}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View className="w-36"><Button title="Guardar captura" compact onPress={() => void saveFrozenPreview()} disabled={livePoseStatus !== 'READY'} /></View>
              <View className="w-28"><Button title="Descartar" compact variant="secondary" onPress={discardFrozenPreview} /></View>
            </>
          )}
        </View>
      ) : (
        <View className="mt-3 flex-row justify-center gap-2">
          <View className="w-40"><Button title="Subir imagen" compact onPress={() => void choosePhoto()} /></View>
        </View>
      )}

      {mode === 'photo' && photoUri ? (
        <>
          <Text className={'mt-2 text-center text-xs ' + (poseStatus === 'failed' ? 'text-amber-700' : 'text-slate-600')}>
            {!photoDataUri ? 'Foto guardada; autoajuste no disponible. Puedes ajustar la prenda manualmente.' : null}
            {photoDataUri && Platform.OS === 'web' ? 'Autoajuste disponible en la aplicación móvil.' : null}
            {poseStatus === 'detecting' ? 'Detectando postura y ajustando…' : null}
            {poseStatus === 'adjusted' ? 'Autoajuste aplicado para ' + zone.toLowerCase() + '.' : null}
            {photoDataUri && poseStatus === 'failed' ? 'No se detectó el cuerpo. Ajusta la prenda manualmente.' : null}
          </Text>
          <View className="mt-3 flex-row flex-wrap justify-center gap-2">
            <View className="w-12"><Button title="−" compact variant="secondary" onPress={() => { scale.value = withSpring(Math.max(0.25, scale.value - 0.1)); }} /></View>
            <View className="w-12"><Button title="+" compact variant="secondary" onPress={() => { scale.value = withSpring(Math.min(3, scale.value + 0.1)); }} /></View>
            <View className="w-12"><Button title="↶" compact variant="secondary" onPress={() => { rotation.value = withSpring(rotation.value - Math.PI / 12); }} /></View>
            <View className="w-12"><Button title="↷" compact variant="secondary" onPress={() => { rotation.value = withSpring(rotation.value + Math.PI / 12); }} /></View>
            <View className="w-28"><Button title="Autoajustar" compact variant="secondary" onPress={rerunAutoFit} disabled={!photoDataUri || !detectorAvailable || poseStatus === 'detecting'} /></View>
            <View className="w-24"><Button title="Reiniciar" compact variant="secondary" onPress={resetGarment} /></View>
          </View>
        </>
      ) : mode === 'live' && livePoseStatus === 'READY' ? (
        <View className="mt-3 flex-row flex-wrap justify-center gap-2">
          <View className="w-12"><Button title="−" compact variant="secondary" onPress={() => { setManualAdjustment(true); scale.value = withSpring(Math.max(0.25, scale.value - 0.1)); }} /></View>
          <View className="w-12"><Button title="+" compact variant="secondary" onPress={() => { setManualAdjustment(true); scale.value = withSpring(Math.min(3, scale.value + 0.1)); }} /></View>
          <View className="w-12"><Button title="↶" compact variant="secondary" onPress={() => { setManualAdjustment(true); rotation.value = withSpring(rotation.value - Math.PI / 12); }} /></View>
          <View className="w-12"><Button title="↷" compact variant="secondary" onPress={() => { setManualAdjustment(true); rotation.value = withSpring(rotation.value + Math.PI / 12); }} /></View>
          <View className="w-28"><Button title="Autoajustar" compact variant="secondary" onPress={() => {
            setManualAdjustment(false);
            const landmarks = latestLiveLandmarks.current;
            const sourceSize = latestLiveFrameSize.current;
            if (!landmarks || !sourceSize || !applyAutoFit(landmarks, sourceSize, cameraFacing === 'front', false, false, zone === 'GORRA')) setLivePoseStatus('SEARCHING');
          }} /></View>
          <View className="w-24"><Button title="Reiniciar" compact variant="secondary" onPress={resetGarment} /></View>
        </View>
      ) : null}

      {mode === 'live' ? <Text className="mt-2 text-center text-sm text-slate-600">{!detectorAvailable && cameraReady ? 'Detección de postura no disponible aquí' : zone === 'GORRA' ? liveGuidanceMessage : LIVE_POSE_MESSAGE[livePoseStatus]}</Text> : null}

      {(mode === 'photo' && photoDataUri || mode === 'live' && liveFrameDataUri && detectorAvailable) ? (
        <WebView
          key={mode === 'live' ? `live-${liveAnalysisAttempt}` : `photo-${analysisAttempt}-${photoDataUri?.length ?? 0}`}
          originWhitelist={['*']}
          source={{ html: buildPoseHtml(mode === 'live' ? liveFrameDataUri! : photoDataUri!) }}
          style={{ width: 1, height: 1, opacity: 0, position: 'absolute' }}
          onMessage={(event) => {
            try {
              const message = JSON.parse(event.nativeEvent.data) as { type?: string; landmarks?: PoseLandmark[] };
              if (mode === 'live') {
                finishLiveAnalysis(message.type === 'POSE' && Array.isArray(message.landmarks) ? message.landmarks : null);
              } else if (message.type === 'POSE' && Array.isArray(message.landmarks)) setPoseLandmarks(message.landmarks);
              else if (message.type === 'FAILED') setPoseStatus('failed');
            } catch {
              if (mode === 'live') finishLiveAnalysis(null);
              else setPoseStatus('failed');
            }
          }}
          onError={() => {
            if (mode === 'live') finishLiveAnalysis(null);
            else setPoseStatus('failed');
          }}
        />
      ) : null}
    </View>
  );
}

function ModelViewer({ modelUrl }: { modelUrl: string }) {
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" /><script type="module" src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"></script><style>html,body,model-viewer{margin:0;width:100%;height:100%;background:#fff7fa}model-viewer{--poster-color:#fff7fa}</style></head><body><model-viewer src="${modelUrl}" camera-controls auto-rotate shadow-intensity="1" exposure="1"></model-viewer></body></html>`;
  return (
    <View className="mt-5 h-[520px] overflow-hidden rounded-2xl border border-rose-100">
      <WebView originWhitelist={['*']} source={{ html }} />
      <Text className="bg-rose-50 px-4 py-3 text-center text-sm text-slate-600">Usa un dedo para rotar el modelo y dos para acercar o alejar.</Text>
    </View>
  );
}
