import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ActivityIndicator, Pressable } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { catalogService } from "@/services/catalog.service";
import { arService } from "@/services/ar.service";
import { Producto } from "@/types/catalog.types";
import { VESTIDOR_SCRIPT } from "@/features/tryon/vestidorWeb.generated";
import { urlImagen } from "@/lib/imagen";

/**
 * Vestidor virtual con la cámara (lentes, gorra o polera), igual al de la web: corre el MISMO código
 * (frontend/src/features/tryon) dentro de un WebView. Ver scripts/generar-vestidor.mjs.
 * - Las imágenes incluidas en el frontend (/tryon/…) viajan dentro de la app (base64).
 * - MediaPipe (librería, runtime y modelo) se descarga del CDN al abrir el vestidor: necesita internet.
 * - La página se carga con origen https://localhost para que el WebView permita usar la cámara.
 */
type Fase = "imagen" | "camara" | "modelo" | "listo";

const ERRORES: Record<string, { titulo: string; texto: string }> = {
  denied: { titulo: "Necesitamos permiso de cámara", texto: "Activa el permiso de cámara para la app en los ajustes del teléfono y vuelve a intentarlo." },
  "no-camera": { titulo: "No encontramos la cámara", texto: "Este teléfono no tiene una cámara frontal disponible." },
  camera: { titulo: "No se pudo abrir la cámara", texto: "Cierra otras apps que estén usando la cámara y vuelve a intentarlo." },
  image: { titulo: "No se pudo cargar la prenda", texto: "La imagen del probador no está disponible. Intenta más tarde." },
  model: { titulo: "No se pudo cargar el detector", texto: "El vestidor necesita internet para descargar el detector de rostro y cuerpo. Revisa tu conexión." },
};

const AYUDA: Record<string, string> = {
  lentes: "Mira de frente a la cámara, con buena luz.",
  gorra: "Mira de frente a la cámara, con buena luz.",
  polera: "Aléjate 1 a 2 metros para que se vean tus hombros y tu cintura.",
};


const html = (tipo: string, imagen: string) => `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  html, body { margin: 0; height: 100%; background: #111; overflow: hidden; }
  /* El video no puede ir con display:none: el WebView de Android no lo arranca. Queda invisible y diminuto. */
  video { position: fixed; top: 0; left: 0; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
  canvas { width: 100vw; height: 100vh; object-fit: cover; display: block; }
</style>
</head><body>
<video id="video" playsinline muted autoplay></video>
<canvas id="lienzo"></canvas>
<script>${VESTIDOR_SCRIPT}</script>
<script>VestidorMovil.iniciar(${JSON.stringify({ tipo, imagen })});</script>
</body></html>`;

export default function VestidorCamaraScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const web = useRef<WebView>(null);

  const [producto, setProducto] = useState<Producto | null>(null);
  const [cargando, setCargando] = useState(true);
  const [permiso, setPermiso] = useState<boolean | null>(null);
  const [fase, setFase] = useState<Fase>("imagen");
  const [detectado, setDetectado] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    catalogService
      .getProductoById(Number(id))
      .then((data) => {
        if (!data.tipoTryOn || !data.imagenTryOn) setError("sin-probador");
        setProducto(data);
        arService.registrarInteraccion(Number(id), "PRUEBA_VIRTUAL").catch(() => {});
      })
      .catch(() => setError("producto"))
      .finally(() => setCargando(false));
  }, [id]);

  // El WebView solo puede usar la cámara si la APP ya tiene el permiso. Se pide con el sistema de
  // permisos de Expo (no con PermissionsAndroid): en Expo Go los permisos son por proyecto y los de
  // PermissionsAndroid no le llegan al WebView, que se quedaba esperando sin abrir la cámara.
  useEffect(() => {
    ImagePicker.requestCameraPermissionsAsync()
      .then((r) => setPermiso(r.granted))
      .catch(() => setPermiso(false));
  }, [intento]);

  const pagina = useMemo(
    () => (producto?.tipoTryOn && producto.imagenTryOn ? html(producto.tipoTryOn, urlImagen(producto.imagenTryOn)!) : null),
    [producto],
  );

  const alMensaje = (e: WebViewMessageEvent) => {
    try {
      const m = JSON.parse(e.nativeEvent.data);
      if (m.tipo === "fase") setFase(m.fase);
      else if (m.tipo === "detectado") setDetectado(Boolean(m.valor));
      else if (m.tipo === "error") {
        setError(m.error);
        setDetalle(m.detalle ?? null);
      }
    } catch {
      // Mensaje que no es del vestidor: se ignora.
    }
  };

  const reintentar = () => {
    setError(null);
    setDetalle(null);
    setFase("imagen");
    setDetectado(true);
    setIntento((n) => n + 1);
  };

  if (cargando) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  const errorVisible =
    error === "sin-probador"
      ? { titulo: "Sin vestidor", texto: "Esta prenda todavía no tiene imagen para el vestidor virtual." }
      : error === "producto"
        ? { titulo: "No se pudo cargar la prenda", texto: "Revisa tu conexión e inténtalo de nuevo." }
        : permiso === false
          ? ERRORES.denied
          : error
            ? ERRORES[error] ?? ERRORES.camera
            : null;

  return (
    <View className="flex-1 bg-black">
      {pagina && permiso && !errorVisible && (
        <WebView
          key={intento}
          ref={web}
          source={{ html: pagina, baseUrl: "https://localhost/" }}
          style={{ flex: 1, backgroundColor: "#111" }}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          mediaCapturePermissionGrantType="grant"
          mixedContentMode="always"
          webviewDebuggingEnabled={__DEV__}
          onError={(e) => {
            setError("camera");
            setDetalle(e.nativeEvent.description);
          }}
          onMessage={alMensaje}
        />
      )}

      {/* Barra superior */}
      <View style={{ paddingTop: insets.top + 8 }} className="absolute left-0 right-0 top-0 flex-row items-center justify-between px-4">
        <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center rounded-full bg-white/90">
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </Pressable>
        {producto && (
          <View className="max-w-[70%] rounded-full bg-white/90 px-4 py-2">
            <Text numberOfLines={1} className="text-sm font-semibold text-gray-900">{producto.nombre}</Text>
          </View>
        )}
        <View className="h-10 w-10" />
      </View>

      {/* Estado: cargando, sin detección o error */}
      {errorVisible ? (
        <View className="absolute inset-0 items-center justify-center px-8">
          <View className="w-full rounded-3xl bg-white p-6">
            <Text className="text-lg font-bold text-gray-900">{errorVisible.titulo}</Text>
            <Text className="mt-2 text-gray-600">{errorVisible.texto}</Text>
            {detalle && <Text className="mt-2 text-xs text-gray-400">Detalle: {detalle}</Text>}
            <View className="mt-5 gap-3">
              {error !== "sin-probador" && <Button title="Reintentar" onPress={reintentar} />}
              <Button title="Volver" variant="outline" onPress={() => router.back()} />
            </View>
          </View>
        </View>
      ) : fase !== "listo" ? (
        <View className="absolute inset-0 items-center justify-center">
          <View className="items-center rounded-2xl bg-black/60 px-6 py-5">
            <ActivityIndicator color="#fff" />
            <Text className="mt-3 text-white">
              {fase === "modelo" ? "Cargando el detector…" : fase === "camara" ? "Abriendo la cámara…" : "Preparando el vestidor…"}
            </Text>
          </View>
        </View>
      ) : (
        !detectado && (
          <View style={{ bottom: insets.bottom + 32 }} className="absolute left-6 right-6 rounded-2xl bg-black/70 px-4 py-3">
            <Text className="text-center text-white">{AYUDA[producto?.tipoTryOn ?? "lentes"]}</Text>
          </View>
        )
      )}
    </View>
  );
}
