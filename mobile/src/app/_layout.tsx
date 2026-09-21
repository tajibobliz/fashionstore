import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../global.css";
import { useAuthStore } from "@/stores/authStore";

const PROTECTED_ROUTES = ["checkout", "order-success", "reservations", "orders", "virtual-fitting"];

export default function RootLayout() {
  const { isLoading, isAuthenticated, loadSession } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    loadSession();
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