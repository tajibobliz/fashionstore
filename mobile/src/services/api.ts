import axios, { AxiosError } from "axios";
import * as SecureStore from "expo-secure-store";
import { API_URL, API_TIMEOUT } from "@/config/env";

// Cliente axios configurado
export const api = axios.create({
  baseURL: API_URL,
  timeout: API_TIMEOUT,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor: agrega token automáticamente a cada request
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor: maneja errores globalmente
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    // Si el token expiró (401), intentar refresh
    if (error.response?.status === 401) {
      const refreshToken = await SecureStore.getItemAsync("refresh_token");
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          });
          // Guardar los tokens nuevos
          await SecureStore.setItemAsync("access_token", data.access_token);
          await SecureStore.setItemAsync("refresh_token", data.refresh_token);
          // Reintentar la petición original con el nuevo token
          if (error.config) {
            error.config.headers.Authorization = `Bearer ${data.access_token}`;
            return axios.request(error.config);
          }
        } catch (refreshError) {
          // Si el refresh también falla, borrar tokens (forzar login)
          await SecureStore.deleteItemAsync("access_token");
          await SecureStore.deleteItemAsync("refresh_token");
        }
      }
    }
    return Promise.reject(error);
  }
);