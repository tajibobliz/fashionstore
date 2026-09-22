import { useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Pressable,
  Alert,
  Linking,
} from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { catalogService } from "@/services/catalog.service";
import { arService } from "@/services/ar.service";
import { Producto } from "@/types/catalog.types";

export default function VirtualFittingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [producto, setProducto] = useState<Producto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [webviewLoading, setWebviewLoading] = useState(true);

  useEffect(() => {
    const fetchProducto = async () => {
      try {
        const data = await catalogService.getProductoById(Number(id));
        if (!data.recursoRaUrl) {
          setError("Este producto no tiene recurso AR disponible.");
          return;
        }
        setProducto(data);

        // Registrar interacción (no bloqueante — si falla, no afecta la experiencia)
        arService
          .registrarInteraccion(Number(id), "PRUEBA_VIRTUAL")
          .catch(() => {
            // Silencioso, solo es analítica
          });
      } catch (e) {
        setError("No se pudo cargar el producto.");
      } finally {
        setLoading(false);
      }
    };
    fetchProducto();
  }, [id]);

  // HTML con model-viewer que carga el recurso 3D del producto
  // HTML con model-viewer que carga el recurso 3D del producto
const buildHtml = (glbUrl: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #fef7f9 0%, #fce7ec 100%);
      overflow: hidden;
    }
    model-viewer {
      width: 100vw;
      height: 100vh;
      background: transparent;
      --poster-color: transparent;
      --progress-bar-color: #e11d48;
      --progress-bar-height: 3px;
    }
    .ar-button {
      background: #e11d48;
      color: white;
      border: none;
      border-radius: 999px;
      padding: 14px 28px;
      font-size: 16px;
      font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      position: absolute;
      bottom: 30px;
      left: 50%;
      transform: translateX(-50%);
      box-shadow: 0 4px 12px rgba(225, 29, 72, 0.4);
      cursor: pointer;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
    }
    .ar-button.ready {
      opacity: 1;
      pointer-events: auto;
    }
    .ar-button:active {
      transform: translateX(-50%) scale(0.97);
    }
    .hint {
      position: absolute;
      top: 110px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.6);
      color: white;
      padding: 8px 16px;
      border-radius: 999px;
      font-size: 13px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    .hint.ready {
      opacity: 1;
    }
    .status {
      position: absolute;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 10px 20px;
      border-radius: 999px;
      font-size: 13px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      pointer-events: none;
    }
    .status.hidden {
      display: none;
    }
  </style>
</head>
<body>
  <div class="hint" id="hint">Arrastra para rotar · Pellizca para zoom</div>
  <div class="status" id="status">Cargando modelo 3D...</div>
  <model-viewer
    id="model"
    src="${glbUrl}"
    alt="Producto en 3D"
    ar
    ar-modes="scene-viewer webxr quick-look"
    camera-controls
    touch-action="pan-y"
    auto-rotate
    shadow-intensity="1"
    exposure="1"
  >
    <button slot="ar-button" class="ar-button" id="arBtn">
      📷 Probar en tu espacio
    </button>
  </model-viewer>

  <script>
    // Esperar a que el modelo cargue completamente antes de activar el botón AR
    const model = document.getElementById('model');
    const arBtn = document.getElementById('arBtn');
    const hint = document.getElementById('hint');
    const status = document.getElementById('status');

    model.addEventListener('load', () => {
      // El modelo terminó de descargarse y renderizarse
      status.classList.add('hidden');
      arBtn.classList.add('ready');
      hint.classList.add('ready');
    });

    model.addEventListener('progress', (event) => {
      const progress = Math.round(event.detail.totalProgress * 100);
      if (progress < 100) {
        status.textContent = 'Cargando modelo 3D... ' + progress + '%';
      }
    });

    model.addEventListener('error', () => {
      status.textContent = 'Error al cargar el modelo';
    });
  </script>
</body>
</html>
`;

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#e11d48" />
        <Text className="mt-3 text-gray-500">Cargando vestidor...</Text>
      </View>
    );
  }

  if (error || !producto || !producto.recursoRaUrl) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Ionicons name="cube-outline" size={60} color="#d1d5db" />
        <Text className="mt-4 text-lg font-semibold text-gray-900">
          Vestidor no disponible
        </Text>
        <Text className="mt-1 text-center text-gray-500">
          {error ?? "Este producto no tiene modelo 3D."}
        </Text>
        <View className="mt-6 w-full">
          <Button title="Volver" onPress={() => router.back()} variant="outline" />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      {/* Header flotante */}
      <View
        className="absolute left-0 right-0 top-0 z-10 flex-row items-center justify-between px-4 pb-3"
        style={{ paddingTop: insets.top + 8 }}
      >
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-white/90"
        >
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </Pressable>
        <View className="rounded-full bg-white/90 px-4 py-2">
          <Text className="text-sm font-semibold text-gray-900">
            {producto.nombre}
          </Text>
        </View>
        <Pressable
          onPress={() =>
            Alert.alert(
              "Vestidor virtual",
              "Arrastra el modelo para rotarlo. Pellizca para hacer zoom. Toca 'Probar en tu espacio' para verlo en AR con tu cámara."
            )
          }
          className="h-10 w-10 items-center justify-center rounded-full bg-white/90"
        >
          <Ionicons name="help-circle-outline" size={22} color="#111827" />
        </Pressable>
      </View>

      {/* WebView con el modelo 3D */}
      <WebView
  source={{ html: buildHtml(producto.recursoRaUrl) }}
  style={{ flex: 1 }}
  originWhitelist={["*", "intent://*", "scene-viewer://*"]}
  javaScriptEnabled
  domStorageEnabled
  onLoadEnd={() => setWebviewLoading(false)}
  allowsInlineMediaPlayback
  mediaPlaybackRequiresUserAction={false}
   onShouldStartLoadWithRequest={(request) => {
  const url = request.url;

  const esSchemeEspecial =
    url.startsWith("intent://") ||
    url.startsWith("scene-viewer:") ||
    url.startsWith("market://") ||
    url.startsWith("mailto:") ||
    url.startsWith("tel:");

  if (!esSchemeEspecial) {
    return true;
  }

  // Si es un intent de Scene Viewer, transformarlo
  // El intent original apunta a googlequicksearchbox (no siempre instalado).
  // Extraemos el archivo .glb y lo abrimos con la URL oficial de Scene Viewer.
  if (url.startsWith("intent://arvr.google.com/scene-viewer")) {
    // Buscar el parametro file=
    const fileMatch = url.match(/file=([^&#]+)/);
    if (fileMatch && fileMatch[1]) {
      const glbUrl = decodeURIComponent(fileMatch[1]);
      // Construimos la URL nativa de Scene Viewer (sin depender de googlequicksearchbox)
      const sceneViewerUrl = `https://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(glbUrl)}&mode=ar_preferred`;
      console.log("[AR] Transformando intent -> URL nativa:", sceneViewerUrl);
      Linking.openURL(sceneViewerUrl).catch((err) => {
        console.log("[AR] Error final:", err.message);
        Alert.alert(
          "AR no disponible",
          "Este dispositivo no soporta el modo AR. Puedes seguir viendo el modelo 3D."
        );
      });
      return false;
    }
  }

  // Otros schemes (mailto, tel, market): intento normal
  Linking.openURL(url).catch(() => {
    Alert.alert(
      "No se pudo abrir",
      "Este dispositivo no puede abrir este tipo de enlace."
    );
  });

  return false;
}}
/>

      {/* Spinner mientras carga el WebView */}
      {webviewLoading && (
        <View className="absolute inset-0 items-center justify-center bg-white">
          <ActivityIndicator size="large" color="#e11d48" />
          <Text className="mt-3 text-gray-500">Cargando modelo 3D...</Text>
        </View>
      )}
    </View>
  );
}