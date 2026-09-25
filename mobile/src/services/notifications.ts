import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Cómo se muestra una notificación que llega con la app ABIERTA (foreground). Sin esto, expo-notifications
 * no muestra nada mientras el usuario está usando la app. Se llama una sola vez, al arrancar (_layout.tsx).
 */
export function setupNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Pide permiso de notificaciones y obtiene el Expo Push Token del dispositivo.
 *
 * Devuelve null (nunca lanza) en cualquiera de estos casos, dejando un aviso en consola:
 * - Corre en un simulador/emulador: no hay push real, solo en un dispositivo físico.
 * - El usuario niega el permiso.
 * - Falta el projectId de EAS en app.json (obligatorio para pedir el token; se completa con `eas init`).
 * - Falla la petición a los servidores de Expo (sin conexión, timeout, etc.).
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn("[push] No disponible en simulador/emulador: probar en un dispositivo físico.");
    return null;
  }

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
 */
export function addNotificationResponseListener(onResponse?: (data: Record<string, unknown>) => void) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data ?? {};
    console.log("[push] Notificación tocada:", data);
    onResponse?.(data);
  });
}
