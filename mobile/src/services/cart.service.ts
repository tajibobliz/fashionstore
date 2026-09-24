import { api } from "./api";
import { Cart } from "@/types/checkout.types";

export const cartService = {
  // Obtiene el carrito del usuario logueado (se crea si no existe)
  async getMyCart(idSucursal: number): Promise<Cart> {
    const { data } = await api.get<Cart>("/cart/me", { params: { idSucursal } });
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

  async updateItem(idDetalleCarrito: number, cantidad: number): Promise<Cart> {
    const { data } = await api.patch<Cart>(`/cart/items/${idDetalleCarrito}`, { cantidad });
    return data;
  },

  async removeItem(idDetalleCarrito: number): Promise<Cart> {
    const { data } = await api.delete<Cart>(`/cart/items/${idDetalleCarrito}`);
    return data;
  },

  // Vacía el carrito completo (útil después de comprar)
  async clearCart(idSucursal: number): Promise<Cart> {
    const { data } = await api.delete<Cart>("/cart/me", { params: { idSucursal } });
    return data;
  },
};
