import { api } from "./api";

export interface ChatResponse {
  consulta: string;
  respuesta: string;
  fecha: string;
  modelo: string;
  tokensUsados: { entrada: number; salida: number };
}

export const aiService = {
  async chat(consulta: string): Promise<ChatResponse> {
    const { data } = await api.post<ChatResponse>("/ai/chat", { consulta });
    return data;
  },
};
