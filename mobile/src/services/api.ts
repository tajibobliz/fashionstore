import axios, { AxiosError, isAxiosError } from "axios";
import { API_URL, API_TIMEOUT } from "@/config/env";
import { mobileLog, mobileWarn } from "@/utils/mobileLogger";
import { getSessionItem, removeSessionItem, setSessionItem } from "@/services/sessionStorage";
import { getRuntimeApiUrl } from "@/services/apiUrl.service";
import { emitInvalidAuthSession } from "@/services/authSessionEvents";

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
  const runtimeApiUrl = await getRuntimeApiUrl();
  config.baseURL = runtimeApiUrl;
  const token = await getSessionItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  mobileLog("API solicitud", {
    method: config.method?.toUpperCase(),
    url: `${runtimeApiUrl}${config.url ?? ""}`,
    hasAccessToken: Boolean(token),
  });
  return config;
});

// Interceptor: maneja errores globalmente
api.interceptors.response.use(
  (response) => {
    mobileLog("API respuesta", {
      method: response.config.method?.toUpperCase(),
      url: `${response.config.baseURL ?? API_URL}${response.config.url ?? ""}`,
      status: response.status,
    });
    return response;
  },
  async (error: AxiosError) => {
    const backendMessage = (error.response?.data as { message?: string | string[] } | undefined)?.message;
    mobileWarn("API error", {
      method: error.config?.method?.toUpperCase(),
      url: `${error.config?.baseURL ?? API_URL}${error.config?.url ?? ""}`,
      status: error.response?.status ?? null,
      code: error.code ?? null,
      message: Array.isArray(backendMessage) ? backendMessage.join(" | ") : backendMessage ?? error.message,
    });
    // Si el token expiró (401), intentar refresh
    const authEndpoint = /^\/auth\/(login|register|refresh|logout)(\/|$)/.test(error.config?.url ?? "");
    if (error.response?.status === 401 && !authEndpoint) {
      const refreshToken = await getSessionItem("refresh_token");
      if (refreshToken) {
        try {
          const runtimeApiUrl = await getRuntimeApiUrl();
          mobileLog("Refresh de sesión iniciado", { url: `${runtimeApiUrl}/auth/refresh` });
          const { data } = await axios.post(`${runtimeApiUrl}/auth/refresh`, {
            refresh_token: refreshToken,
          });
          // Guardar los tokens nuevos
          await setSessionItem("access_token", data.access_token);
          await setSessionItem("refresh_token", data.refresh_token);
          mobileLog("Refresh de sesión completado", { hasUser: Boolean(data.user) });
          // Reintentar la petición original con el nuevo token
          if (error.config) {
            error.config.headers.Authorization = `Bearer ${data.access_token}`;
            return axios.request(error.config);
          }
        } catch (refreshError) {
          mobileWarn("Refresh de sesión falló", { reason: refreshError instanceof Error ? refreshError.message : "Error desconocido" });
          const refreshStatus = isAxiosError(refreshError) ? refreshError.response?.status : undefined;
          if (refreshStatus === 401 || refreshStatus === 403) {
            mobileWarn("Refresh token rechazado; se limpia la sesión local", { status: refreshStatus });
            await Promise.all([
              removeSessionItem("access_token"),
              removeSessionItem("refresh_token"),
              removeSessionItem("user"),
            ]);
            emitInvalidAuthSession();
          } else {
            // Un timeout, fallo de conexión u otro error del servidor no invalida las credenciales guardadas.
            return Promise.reject(refreshError);
          }
        }
      }
    }
    return Promise.reject(error);
  }
);
