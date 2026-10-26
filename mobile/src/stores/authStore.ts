import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { User } from "@/types";
import { authService } from "@/services/auth.service";
import { usersService } from "@/services/users.service";
import { isExpoGo, registerForPushNotificationsAsync } from "@/services/notifications";
import { tienda } from "@/config/tienda";
import { useSucursalStore } from "@/stores/sucursalStore";
import { prepararOffline } from "@/offline/catalog";
import { sincronizarPronto } from "@/offline/sync";

/**
 * Después de iniciar sesión: recordar la tienda de la cuenta y, si cambió, olvidar la
 * sucursal elegida (era de otra empresa). Luego, en segundo plano, guardar el catálogo
 * para usarlo sin conexión y enviar operaciones pendientes.
 */
async function despuesDeEntrar(user: User) {
  const anterior = await tienda.cargar();
  const nueva = user.empresa?.slug ?? null;
  if (anterior !== nueva) await useSucursalStore.getState().limpiar();
  await tienda.guardar(nueva);
  if (user.rol === "CLIENTE" && user.idEmpresa) void prepararOffline(user.idEmpresa);
  sincronizarPronto(1500);
}

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

  // Actions
  login: (email: string, password: string, empresa?: string) => Promise<void>;
  register: (data: {
    nombre: string;
    apellido?: string;
    email: string;
    password: string;
    telefono?: string;
    empresa?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password, empresa) => {
    const response = await authService.login({ email, password, ...(empresa ? { empresa } : {}) });
    await SecureStore.setItemAsync("access_token", response.access_token);
    await SecureStore.setItemAsync("refresh_token", response.refresh_token);
    await SecureStore.setItemAsync("user", JSON.stringify(response.user));
    set({ user: response.user, isAuthenticated: true });
    await despuesDeEntrar(response.user);
    void registerPushTokenSilently();
  },

  register: async (data) => {
    const response = await authService.register(data);
    await SecureStore.setItemAsync("access_token", response.access_token);
    await SecureStore.setItemAsync("refresh_token", response.refresh_token);
    await SecureStore.setItemAsync("user", JSON.stringify(response.user));
    set({ user: response.user, isAuthenticated: true });
    await despuesDeEntrar(response.user);
    void registerPushTokenSilently();
  },

  logout: async () => {
    const refreshToken = await SecureStore.getItemAsync("refresh_token");
    if (refreshToken) {
      try {
        await authService.logout(refreshToken);
      } catch {
        // Ignoramos error del backend, igual limpiamos local
      }
    }
    await SecureStore.deleteItemAsync("access_token");
    await SecureStore.deleteItemAsync("refresh_token");
    await SecureStore.deleteItemAsync("user");
    set({ user: null, isAuthenticated: false });
  },

  // Al arrancar la app, recuperar sesión si existía
  loadSession: async () => {
    try {
      const token = await SecureStore.getItemAsync("access_token");
      const userJson = await SecureStore.getItemAsync("user");
      if (token && userJson) {
        set({
          user: JSON.parse(userJson),
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));