import { api } from "./api";
import { AuthResponse } from "@/types";
import { mobileLog } from "@/utils/mobileLogger";

interface LoginData {
  email: string;
  password: string;
}

interface RegisterData {
  nombre: string;
  apellido?: string;
  email: string;
  password: string;
  telefono?: string;
}

export const authService = {
  async login(data: LoginData): Promise<AuthResponse> {
    mobileLog("Login enviado", { endpoint: "/auth/login", emailProvided: Boolean(data.email), passwordProvided: Boolean(data.password) });
    const response = await api.post<AuthResponse>("/auth/login", data);
    mobileLog("Login recibido", { status: response.status, role: response.data.user?.rol ?? null, userId: response.data.user?.idUsuario ?? null });
    return response.data;
  },

  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>("/auth/register", data);
    return response.data;
  },

  async logout(refreshToken: string): Promise<void> {
    await api.post("/auth/logout", { refresh_token: refreshToken });
  },

  async getProfile() {
    const response = await api.get("/auth/profile");
    return response.data;
  },
};
