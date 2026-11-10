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
import { useMonedaStore } from "@/lib/moneda";

const PROTECTED_ROUTES = ["checkout", "order-success", "reservations", "orders", "virtual-fitting", "chat", "offline", "pagar"];

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
    // Moneda de la tienda: primero la guardada (sirve sin conexión), luego la del backend.
    void useMonedaStore.getState().cargar().then(async () => useMonedaStore.getState().actualizar(await tienda.cargar()));
    void useSucursalStore.getState().cargar();
    void iniciarSincronizacion();
  }, [loadSession]);

  // Con sesión de clienta, refrescar el catálogo guardado para usarlo sin conexión.
  useEffect(() => {
    if (isAuthenticated && user?.rol === "CLIENTE" && user.idEmpresa) void prepararOffline(user.idEmpresa);
  }, [isAuthenticated, user?.idEmpresa, user?.rol]);

  // Listener global: el usuario toca una notificación (app en foreground, background o cerrada).
  useEffect(() => {
    // Al tocar una notificación se abre lo que corresponde: un pedido (compra confirmada, pago
    // rechazado, pedido vencido) o una reserva (lista para probar).
    const subscription = addNotificationResponseListener((data) => {
      if (data.tipo === "venta" && data.idVenta) router.push(`/orders/${data.idVenta}` as any);
      else if (data.tipo === "reserva" && data.idReserva) router.push(`/reservations/${data.idReserva}` as any);
    });
    return () => subscription.remove();
  }, [router]);

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
  }, [isAuthenticated, isLoading, router, segments]);

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
