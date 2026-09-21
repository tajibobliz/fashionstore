import { api } from "./api";
import { CreateSaleFromCartDto, Sale } from "@/types/checkout.types";

export const salesService = {
  // Convierte el carrito del backend en una venta (queda PENDIENTE de pago)
  async createFromCart(dto: CreateSaleFromCartDto): Promise<Sale> {
    const { data } = await api.post<Sale>("/sales/from-cart", dto);
    return data;
  },

  // Obtiene el historial del usuario logueado
  async getMySales(): Promise<Sale[]> {
    const { data } = await api.get<Sale[]>("/sales/me");
    return data;
  },
};