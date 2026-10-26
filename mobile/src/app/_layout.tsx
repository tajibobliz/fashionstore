import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../global.css";
import { useAuthStore } from "@/stores/authStore";
import { addNotificationResponseListener, setupNotificationHandler } from "@/services/notifications";
import { useSucursalStore } from "@/stores/sucursalStore";
import { tienda } from "@/config/tienda";
import { iniciarSincronizacion } from "@/offline/sync";
import { prepararOffline } from "@/offline/catalog";

const PROTECTED_ROUTES = ["checkout", "order-success", "reservations", "orders", "virtual-fitting", "chat", "offline"];

// Que la app muestre las notificaciones que llegan mientras está abierta (foreground). Se hace una sola
// vez al cargar el módulo, no en el componente, para que quede configurado antes de que llegue cualquiera.
setupNotificationHandler();

export default function RootLayout() {
  const { isLoading, isAuthenticated, loadSession, user } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    loadSession();
    // Fase 2 (offline): tienda y sucursal recordadas + motor de sincronización.
    void tienda.cargar();
    void useSucursalStore.getState().cargar();
    void iniciarSincronizacion();
  }, []);

  // Con sesión de clienta, refrescar el catálogo guardado para usarlo sin conexión.
  useEffect(() => {
    if (isAuthenticated && user?.rol === "CLIENTE" && user.idEmpresa) void prepararOffline(user.idEmpresa);
  }, [isAuthenticated, user?.idEmpresa, user?.rol]);

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
      router.replace("/" as any);
    }
  }, [isAuthenticated, isLoading, segments]);

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}