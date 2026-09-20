import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import "../global.css";
import { useAuthStore } from "@/stores/authStore";

export default function RootLayout() {
  const { isAuthenticated, isLoading, loadSession } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  // 1) Al abrir la app, recuperar la sesión guardada (si existe)
  useEffect(() => {
    loadSession();
  }, []);

  // 2) Cada vez que cambie la sesión o la ruta, decidir a dónde ir
  useEffect(() => {
    if (isLoading) return; // esperamos a saber si hay sesión

    const inAuthGroup = segments[0] === "(auth)";

    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/login");
    } else if (isAuthenticated && inAuthGroup) {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading, segments]);

  return <Stack screenOptions={{ headerShown: false }} />;
}