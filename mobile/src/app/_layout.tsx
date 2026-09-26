import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ActivityIndicator, View } from "react-native";
import "../global.css";
import { useAuthStore } from "@/stores/authStore";
import { addNotificationResponseListener, setupNotificationHandler } from "@/services/notifications";

const PROTECTED_ROUTES = ["dashboard", "cart", "profile", "checkout", "order-success", "reservations", "orders", "virtual-fitting", "chat"];

// Que la app muestre las notificaciones que llegan mientras está abierta (foreground). Se hace una sola
// vez al cargar el módulo, no en el componente, para que quede configurado antes de que llegue cualquiera.
setupNotificationHandler();

export default function RootLayout() {
  const { isLoading, isAuthenticated, loadSession } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    loadSession();
  }, []);

  // Listener global: el usuario toca una notificación (app en foreground, background o cerrada).
  // Por ahora es genérico (solo loguea el payload); la navegación a la pantalla correspondiente según
  // data.tipo/data.id (p. ej. {tipo: 'reserva', id: 123}) se agrega en una fase posterior.
  useEffect(() => {
    const subscription = addNotificationResponseListener();
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const currentRoute = segments.join("/");
    const inAuthGroup = (segments[0] as string) === "(auth)";
    const isProtected = PROTECTED_ROUTES.some((r) => currentRoute.includes(r));

    if (isProtected && !isAuthenticated) {
      router.replace("/login" as any);
    } else if (inAuthGroup && isAuthenticated) {
      router.replace("/dashboard" as any);
    }
  }, [isAuthenticated, isLoading, segments]);

  if (isLoading) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <View className="flex-1 items-center justify-center bg-white">
            <ActivityIndicator color="#e11d48" />
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
