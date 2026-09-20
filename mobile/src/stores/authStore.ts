import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { User } from "@/types";
import { authService } from "@/services/auth.service";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    nombre: string;
    apellido?: string;
    email: string;
    password: string;
    telefono?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    const response = await authService.login({ email, password });
    await SecureStore.setItemAsync("access_token", response.access_token);
    await SecureStore.setItemAsync("refresh_token", response.refresh_token);
    await SecureStore.setItemAsync("user", JSON.stringify(response.user));
    set({ user: response.user, isAuthenticated: true });
  },

  register: async (data) => {
    const response = await authService.register(data);
    await SecureStore.setItemAsync("access_token", response.access_token);
    await SecureStore.setItemAsync("refresh_token", response.refresh_token);
    await SecureStore.setItemAsync("user", JSON.stringify(response.user));
    set({ user: response.user, isAuthenticated: true });
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