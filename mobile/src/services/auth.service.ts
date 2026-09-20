import { api } from "./api";
import { AuthResponse } from "@/types";

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
    const response = await api.post<AuthResponse>("/auth/login", data);
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