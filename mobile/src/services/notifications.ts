import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";

// Desde el SDK 53, Expo quitó el módulo nativo de push de Expo Go (Android e iOS): cualquier llamada a
// expo-notifications ahí revienta la app. `expo-constants` y `expo-device` sí funcionan en Expo Go, así
// que son import estático normal; `expo-notifications` se importa con import() dinámico y solo cuando
// NO estamos en Expo Go, para que su módulo ni siquiera se cargue ahí.
//
// Constants.appOwnership === 'expo' identifica específicamente Expo Go. Aunque está @deprecated a favor
// de `executionEnvironment`, ESE valor ('storeClient') agrupa Expo Go CON los development builds
// (expo-dev-client) bajo el mismo string, así que no sirve para distinguir uno de otro: usarlo apagaría
// las notificaciones también en development build, que es justo donde sí deben funcionar.
function isExpoGo(): boolean {
  return Constants.appOwnership === "expo";
}

/**
 * Cómo se muestra una notificación que llega con la app ABIERTA (foreground). Sin esto, expo-notifications
 * no muestra nada mientras el usuario está usando la app. Se llama una sola vez, al arrancar (_layout.tsx).
 * En Expo Go no hace nada (solo avisa): el módulo nativo de push no existe ahí.
 */
export function setupNotificationHandler() {
  if (isExpoGo()) {
    console.warn("[push] Expo Go: notificaciones push deshabilitadas. Usa un development build o un APK.");
    return;
  }
  void import("expo-notifications").then((Notifications) => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  });
}

/**
 * Pide permiso de notificaciones y obtiene el Expo Push Token del dispositivo.
 *
 * Devuelve null (nunca lanza) en cualquiera de estos casos, dejando un aviso en consola:
 * - Corre en Expo Go: push no soportado ahí desde el SDK 53; probar con un development build o un APK.
 * - Corre en un simulador/emulador: no hay push real, solo en un dispositivo físico.
 * - El usuario niega el permiso.
 * - Falta el projectId de EAS en app.json (obligatorio para pedir el token; se completa con `eas init`).
 * - Falla la petición a los servidores de Expo (sin conexión, timeout, etc.).
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (isExpoGo()) {
    console.warn("[push] Push notifications solo funcionan en development build o APK, no en Expo Go.");
    return null;
  }

  if (!Device.isDevice) {
    console.warn("[push] No disponible en simulador/emulador: probar en un dispositivo físico.");
    return null;
  }

  const Notifications = await import("expo-notifications");

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    ({ status: finalStatus } = await Notifications.requestPermissionsAsync());
  }
  if (finalStatus !== "granted") {
    console.warn("[push] El usuario no concedió permiso de notificaciones.");
    return null;
  }

  // TODO: falta configurar el projectId de EAS (ejecutar `eas init` en mobile/ y que expo lo escriba en app.json).
  // Sin él, getExpoPushTokenAsync() lanza y esta función devuelve null silenciosamente (ver catch abajo).
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn("[push] Falta el projectId de EAS en app.json. Ejecuta 'eas init' en mobile/.");
    return null;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    return token;
  } catch (error) {
    console.warn("[push] No se pudo obtener el Expo Push Token:", error);
    return null;
  }
}

/**
 * Listener global: se dispara cuando el usuario toca una notificación (con la app en cualquier estado).
 * Por ahora es genérico y solo registra el payload en consola; la navegación según `data.tipo`/`data.id`
 * (p. ej. {tipo: 'reserva', id: 123} → pantalla de esa reserva) se agrega en una fase posterior.
 *
 * Devuelve un objeto `{ remove }` de forma SÍNCRONA (mismo contrato que antes), aunque por dentro el
 * import de expo-notifications sea asíncrono, para que _layout.tsx pueda seguir usándolo tal cual en un
 * useEffect: `const sub = addNotificationResponseListener(); return () => sub.remove()`. Si el componente
 * se desmonta antes de que el import resuelva (`removed`), se cancela la suscripción en cuanto llega.
 */
export function addNotificationResponseListener(onResponse?: (data: Record<string, unknown>) => void) {
  if (isExpoGo()) return { remove: () => {} };

  let subscription: { remove: () => void } | null = null;
  let removed = false;
  void import("expo-notifications").then((Notifications) => {
    if (removed) return;
    subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data ?? {};
      console.log("[push] Notificación tocada:", data);
      onResponse?.(data);
    });
  });
  return {
    remove: () => {
      removed = true;
      subscription?.remove();
    },
  };
}

export { isExpoGo };
