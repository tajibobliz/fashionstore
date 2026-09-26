import { create } from "zustand";

import { authService } from "@/services/auth.service";
import { getSessionItem, removeSessionItem, setSessionItem } from "@/services/sessionStorage";
import { useCartStore } from "@/stores/cartStore";
import type { User } from "@/types";
import { mobileLog, mobileWarn } from "@/utils/mobileLogger";
import { usersService } from "@/services/users.service";
import { isExpoGo, registerForPushNotificationsAsync } from "@/services/notifications";

// Pide el permiso y registra el Expo Push Token en el backend. Nunca debe romper el login: si el
// dispositivo no soporta push, el usuario niega el permiso, o falla la red, solo se registra en consola.
async function registerPushTokenSilently() {
  try {
    // registerForPushNotificationsAsync() ya hace este mismo chequeo internamente (y ahí es donde
    // importa que ni siquiera cargue expo-notifications), pero se corta acá también para no ni
    // siquiera intentar la llamada en Expo Go.
    if (isExpoGo()) {
      console.warn("[push] Expo Go: no se registra el push token.");
      return;
    }
    const token = await registerForPushNotificationsAsync();
    if (token) await usersService.registerPushToken(token);
  } catch (error) {
    console.warn("[push] No se pudo registrar el token en el backend:", error);
  }
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { nombre: string; apellido?: string; email: string; password: string; telefono?: string }) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
}

async function clearStoredSession() {
  await Promise.all([
    removeSessionItem("access_token"),
    removeSessionItem("refresh_token"),
    removeSessionItem("user"),
  ]);
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    const response = await authService.login({ email, password });
    await setSessionItem("access_token", response.access_token);
    await setSessionItem("refresh_token", response.refresh_token);
    await setSessionItem("user", JSON.stringify(response.user));
    set({ user: response.user, isAuthenticated: true });
    mobileLog("Sesión iniciada", { userId: response.user.idUsuario, role: response.user.rol });
    void registerPushTokenSilently();
  },

  register: async (data) => {
    const response = await authService.register(data);
    await setSessionItem("access_token", response.access_token);
    await setSessionItem("refresh_token", response.refresh_token);
    await setSessionItem("user", JSON.stringify(response.user));
    set({ user: response.user, isAuthenticated: true });
    void registerPushTokenSilently();
  },

  logout: async () => {
    const refreshTokenPromise = getSessionItem("refresh_token");
    set({ user: null, isAuthenticated: false });
    useCartStore.getState().clearCartCache();
    mobileLog("Sesión cerrada localmente");

    // No bloquea la salida: si el servidor está caído, la aplicación igual
    // debe abandonar la sesión y volver a Login.
    const refreshToken = await refreshTokenPromise.catch(() => null);
    await clearStoredSession();
    if (refreshToken) void authService.logout(refreshToken).catch(() => undefined);
  },

  loadSession: async () => {
    try {
      const token = await getSessionItem("access_token");
      const userJson = await getSessionItem("user");
      if (!token || !userJson) {
        set({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }

      const storedUser = JSON.parse(userJson) as User;
      const profile = await authService.getProfile() as Pick<User, "idUsuario" | "email" | "rol">;
      if (profile.idUsuario !== storedUser.idUsuario) {
        throw new Error("La sesión almacenada no coincide con el usuario autenticado");
      }

      set({
        user: { ...storedUser, email: profile.email, rol: profile.rol },
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      mobileWarn("Sesión inválida; se mostrará Login", {
        reason: error instanceof Error ? error.message : "Error desconocido",
      });
      await clearStoredSession();
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
