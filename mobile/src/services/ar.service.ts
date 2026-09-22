import { api } from "./api";

// Tipos de interacción según el backend
export type TipoInteraccionAR =
  | "VISUALIZACION"
  | "BUSQUEDA"
  | "RESERVA"
  | "COMPRA"
  | "PRUEBA_VIRTUAL";

export const arService = {
  // Registra una interacción de AR (para analítica)
  async registrarInteraccion(idProducto: number, tipo: TipoInteraccionAR) {
    const { data } = await api.post("/ar/interaccion", {
      idProducto,
      tipo,
    });
    return data;
  },
};