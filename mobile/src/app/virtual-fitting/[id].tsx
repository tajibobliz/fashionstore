import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { WebView } from 'react-native-webview';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { AuthenticatedHeader } from '@/components/layout/AuthenticatedHeader';
import { arService } from '@/services/ar.service';
import { catalogService } from '@/services/catalog.service';
import type { Producto } from '@/types/catalog.types';

const GARMENT_WIDTH = 190;
const GARMENT_HEIGHT = 250;

type GarmentZone = 'SUPERIOR' | 'INFERIOR' | 'FALDA' | 'VESTIDO';

type PoseLandmark = {
  x: number;
  y: number;
  visibility?: number;
};

type PreviewSize = {
  width: number;
  height: number;
};

const imageExtension = /\.(png|jpe?g|webp)(\?.*)?$/i;
const modelExtension = /\.(glb|gltf)(\?.*)?$/i;

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function resolveGarmentZone(categoryName?: string | null): GarmentZone {
  const category = normalize(categoryName ?? '');

  if (/(vestido)/.test(category)) return 'VESTIDO';
  if (/(falda)/.test(category)) return 'FALDA';
  if (/(pantalon|jean)/.test(category)) return 'INFERIOR';
  return 'SUPERIOR';
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const [product, setProduct] = useState<Producto | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'photo' | 'model'>('photo');

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

  const garmentImage = useMemo(() => {
    if (!product) return null;
    if (product.imagenUrl) return product.imagenUrl;
    return product.recursoRaUrl && imageExtension.test(product.recursoRaUrl) ? product.recursoRaUrl : null;
  }, [product]);

  const modelUrl = product?.recursoRaUrl && modelExtension.test(product.recursoRaUrl) ? product.recursoRaUrl : null;

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#be3d6d" />
      </SafeAreaView>
    );
  }

  if (!product || !garmentImage) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-center text-lg font-semibold text-slate-900">Este producto no tiene una imagen para probar.</Text>
        <View className="mt-5 w-full"><Button title="Volver al producto" onPress={() => router.back()} /></View>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <AuthenticatedHeader title="Vestidor virtual" />
      <ScrollView contentContainerClassName="px-4 pb-8" showsVerticalScrollIndicator={false}>
        <Text className="text-2xl font-bold text-slate-950">Vestidor virtual</Text>
        <Text className="mt-1 text-sm text-slate-600">{product.nombre}</Text>

        <View className="mt-5 flex-row rounded-xl bg-rose-50 p-1">
          <Pressable
            onPress={() => setMode('photo')}
            className={`flex-1 rounded-lg px-3 py-2 ${mode === 'photo' ? 'bg-white' : ''}`}
          >
            <Text className={`text-center font-semibold ${mode === 'photo' ? 'text-rose-700' : 'text-slate-600'}`}>Probar con foto</Text>
          </Pressable>
          {modelUrl && Platform.OS !== 'web' ? (
            <Pressable
              onPress={() => setMode('model')}
              className={`flex-1 rounded-lg px-3 py-2 ${mode === 'model' ? 'bg-white' : ''}`}
            >
              <Text className={`text-center font-semibold ${mode === 'model' ? 'text-rose-700' : 'text-slate-600'}`}>Ver modelo 3D</Text>
            </Pressable>
          ) : null}
        </View>

        {mode === 'photo' ? (
          <PhotoFitting garmentImage={garmentImage} categoryName={product.categoria?.nombre} />
        ) : modelUrl && Platform.OS !== 'web' ? (
          <ModelViewer modelUrl={modelUrl} />
        ) : null}
      </ScrollView>
    </View>
  );
}

function PhotoFitting({ garmentImage, categoryName }: { garmentImage: string; categoryName?: string | null }) {
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoDataUri, setPhotoDataUri] = useState<string | null>(null);
  const [photoSize, setPhotoSize] = useState<PreviewSize | null>(null);
  const [previewSize, setPreviewSize] = useState<PreviewSize | null>(null);
  const [poseLandmarks, setPoseLandmarks] = useState<PoseLandmark[] | null>(null);
  const [poseStatus, setPoseStatus] = useState<'idle' | 'detecting' | 'adjusted' | 'failed'>('idle');
  const [analysisAttempt, setAnalysisAttempt] = useState(0);
  const appliedAttempt = useRef(0);
  const zone = useMemo(() => resolveGarmentZone(categoryName), [categoryName]);
  const detectorAvailable = Platform.OS !== 'web';

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
  }, [rotation, scale, translateX, translateY]);

  const applyAutoFit = useCallback(() => {
    if (!poseLandmarks || !photoSize || !previewSize) return false;

    const leftShoulder = poseLandmarks[11];
    const rightShoulder = poseLandmarks[12];
    const leftHip = poseLandmarks[23];
    const rightHip = poseLandmarks[24];
    const leftKnee = poseLandmarks[25];
    const rightKnee = poseLandmarks[26];
    const leftAnkle = poseLandmarks[27];
    const rightAnkle = poseLandmarks[28];

    if (!isVisible(leftShoulder) || !isVisible(rightShoulder) || !isVisible(leftHip) || !isVisible(rightHip)) return false;

    const shoulderCenter = midpoint(leftShoulder, rightShoulder);
    const hipCenter = midpoint(leftHip, rightHip);
    const kneeCenter = isVisible(leftKnee) && isVisible(rightKnee) ? midpoint(leftKnee, rightKnee) : null;
    const ankleCenter = isVisible(leftAnkle) && isVisible(rightAnkle) ? midpoint(leftAnkle, rightAnkle) : null;

    let top = shoulderCenter;
    let bottom = hipCenter;
    let width = distance(leftShoulder, rightShoulder);

    if (zone === 'INFERIOR') {
      if (!ankleCenter) return false;
      top = hipCenter;
      bottom = ankleCenter;
      width = distance(leftHip, rightHip);
    }
    if (zone === 'FALDA') {
      if (!kneeCenter) return false;
      top = hipCenter;
      bottom = kneeCenter;
      width = distance(leftHip, rightHip);
    }
    if (zone === 'VESTIDO') {
      const dressBottom = ankleCenter ?? kneeCenter;
      if (!dressBottom) return false;
      top = shoulderCenter;
      bottom = dressBottom;
      width = Math.max(distance(leftShoulder, rightShoulder), distance(leftHip, rightHip));
    }

    const coverScale = Math.max(previewSize.width / photoSize.width, previewSize.height / photoSize.height);
    const renderedWidth = photoSize.width * coverScale;
    const renderedHeight = photoSize.height * coverScale;
    const offsetX = (previewSize.width - renderedWidth) / 2;
    const offsetY = (previewSize.height - renderedHeight) / 2;
    const map = (point: PoseLandmark) => ({ x: offsetX + point.x * renderedWidth, y: offsetY + point.y * renderedHeight });

    const mappedTop = map(top);
    const mappedBottom = map(bottom);
    const targetCenterX = (mappedTop.x + mappedBottom.x) / 2;
    const targetCenterY = (mappedTop.y + mappedBottom.y) / 2;
    const targetHeight = Math.hypot(mappedTop.x - mappedBottom.x, mappedTop.y - mappedBottom.y);
    const targetWidth = width * renderedWidth;
    const fittedScale = Math.min(2.8, Math.max(0.35, Math.min((targetHeight * 1.08) / GARMENT_HEIGHT, (targetWidth * 1.1) / GARMENT_WIDTH)));

    translateX.value = withSpring(targetCenterX - previewSize.width / 2);
    translateY.value = withSpring(targetCenterY - previewSize.height / 2);
    scale.value = withSpring(fittedScale);
    rotation.value = withSpring(0);
    setPoseStatus('adjusted');
    return true;
  }, [photoSize, poseLandmarks, previewSize, rotation, scale, translateX, translateY, zone]);

  useEffect(() => {
    if (!poseLandmarks || analysisAttempt === 0 || appliedAttempt.current === analysisAttempt) return;
    if (!photoSize || !previewSize) return;
    appliedAttempt.current = analysisAttempt;
    if (!applyAutoFit()) setPoseStatus('failed');
  }, [analysisAttempt, applyAutoFit, photoSize, poseLandmarks, previewSize]);

  useEffect(() => {
    if (poseStatus !== 'detecting') return;
    const timeout = setTimeout(() => setPoseStatus('failed'), 15000);
    return () => clearTimeout(timeout);
  }, [poseStatus]);

  const choosePhoto = async (fromCamera: boolean) => {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permiso necesario', fromCamera ? 'Activa el permiso de cámara para tomar una foto.' : 'Activa el permiso de galería para elegir una foto.');
      return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, base64: true });

    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPhotoUri(asset.uri);
    setPhotoSize(asset.width && asset.height ? { width: asset.width, height: asset.height } : null);
    setPoseLandmarks(null);
    appliedAttempt.current = 0;
    resetGarment();

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
  };

  const onPreviewLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) setPreviewSize({ width, height });
  };

  const rerunAutoFit = () => {
    if (!photoDataUri || !detectorAvailable) return;
    appliedAttempt.current = 0;
    setPoseLandmarks(null);
    setPoseStatus('detecting');
    setAnalysisAttempt((current) => current + 1);
  };

  const pan = Gesture.Pan()
    .onBegin(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = startX.value + event.translationX;
      translateY.value = startY.value + event.translationY;
    });
  const pinch = Gesture.Pinch()
    .onBegin(() => { startScale.value = scale.value; })
    .onUpdate((event) => { scale.value = Math.min(3, Math.max(0.25, startScale.value * event.scale)); });
  const rotate = Gesture.Rotation()
    .onBegin(() => { startRotation.value = rotation.value; })
    .onUpdate((event) => { rotation.value = startRotation.value + event.rotation; });
  const gesture = Gesture.Simultaneous(pan, pinch, rotate);

  return (
    <View className="mt-5">
      <Text className="text-sm leading-5 text-slate-600">Usa una foto de cuerpo completo para intentar un ajuste automático. Siempre puedes corregir la prenda manualmente.</Text>
      <View className="mt-4 flex-row gap-3">
        <View className="flex-1"><Button title="Tomar foto" onPress={() => void choosePhoto(true)} /></View>
        <View className="flex-1"><Button title="Elegir de galería" variant="secondary" onPress={() => void choosePhoto(false)} /></View>
      </View>

      {photoUri ? (
        <>
          <View onLayout={onPreviewLayout} className="relative mt-5 h-[480px] overflow-hidden rounded-2xl bg-slate-950">
            <Image source={{ uri: photoUri }} resizeMode="cover" className="h-full w-full" />
            <GestureDetector gesture={gesture}>
              <Animated.View
                style={[{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: GARMENT_WIDTH,
                  height: GARMENT_HEIGHT,
                  marginLeft: -GARMENT_WIDTH / 2,
                  marginTop: -GARMENT_HEIGHT / 2,
                }, garmentStyle]}
              >
                <Image source={{ uri: garmentImage }} resizeMode="contain" className="h-full w-full" />
              </Animated.View>
            </GestureDetector>
          </View>

          <Text className={`mt-3 text-center text-sm ${poseStatus === 'failed' ? 'text-amber-700' : 'text-slate-600'}`}>
            {Platform.OS === 'web' ? 'Autoajuste disponible en la aplicación móvil.' : null}
            {poseStatus === 'detecting' ? 'Detectando postura y ajustando la prenda…' : null}
            {poseStatus === 'adjusted' ? `Ajuste automático aplicado para ${zone.toLowerCase()}. Puedes corregirlo manualmente.` : null}
            {poseStatus === 'failed' ? 'No se pudo detectar el cuerpo. Ajusta la prenda manualmente.' : null}
          </Text>

          <View className="mt-4 flex-row flex-wrap justify-center gap-2">
            <View className="w-14"><Button title="−" variant="secondary" onPress={() => { scale.value = withSpring(Math.max(0.25, scale.value - 0.1)); }} /></View>
            <View className="w-14"><Button title="+" variant="secondary" onPress={() => { scale.value = withSpring(Math.min(3, scale.value + 0.1)); }} /></View>
            <View className="w-14"><Button title="↶" variant="secondary" onPress={() => { rotation.value = withSpring(rotation.value - Math.PI / 12); }} /></View>
            <View className="w-14"><Button title="↷" variant="secondary" onPress={() => { rotation.value = withSpring(rotation.value + Math.PI / 12); }} /></View>
            <View className="w-32"><Button title="Autoajustar" variant="secondary" onPress={rerunAutoFit} disabled={!detectorAvailable || poseStatus === 'detecting'} /></View>
            <View className="w-28"><Button title="Reiniciar" variant="secondary" onPress={resetGarment} /></View>
          </View>
        </>
      ) : (
        <View className="mt-5 items-center rounded-2xl border border-dashed border-rose-200 bg-rose-50 px-6 py-12">
          <Text className="text-center text-slate-600">Toma o elige una foto para colocar la prenda sobre ella.</Text>
        </View>
      )}

      {photoDataUri && detectorAvailable ? (
        <WebView
          key={`${analysisAttempt}-${photoDataUri.length}`}
          originWhitelist={['*']}
          source={{ html: buildPoseHtml(photoDataUri) }}
          style={{ width: 1, height: 1, opacity: 0, position: 'absolute' }}
          onMessage={(event) => {
            try {
              const message = JSON.parse(event.nativeEvent.data) as { type?: string; landmarks?: PoseLandmark[] };
              if (message.type === 'POSE' && Array.isArray(message.landmarks)) setPoseLandmarks(message.landmarks);
              else if (message.type === 'FAILED') setPoseStatus('failed');
            } catch {
              setPoseStatus('failed');
            }
          }}
          onError={() => setPoseStatus('failed')}
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
