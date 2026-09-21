import { api } from "./api";
import { Cart } from "@/types/checkout.types";

export const cartService = {
  // Obtiene el carrito del usuario logueado (se crea si no existe)
  async getMyCart(): Promise<Cart> {
    const { data } = await api.get<Cart>("/cart/me");
    return data;
  },

  // Agrega un item al carrito del backend
  async addItem(idVariante: number, cantidad: number, idSucursal: number) {
    const { data } = await api.post("/cart/items", {
      idVariante,
      cantidad,
      idSucursal,
    });
    return data;
  },

  // Vacía el carrito completo (útil después de comprar)
  async clearCart() {
    await api.delete("/cart/me");
  },
};