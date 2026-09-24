import { create } from "zustand";

import type { Cart } from "@/types/checkout.types";

interface CartState {
  cart: Cart | null;
  setCart: (cart: Cart | null) => void;
  clearCartCache: () => void;
  getTotalItems: () => number;
  getSubtotal: () => number;
}

// Cache de interfaz. El carrito y sus mutaciones siempre viven en el backend.
export const useCartStore = create<CartState>((set, get) => ({
  cart: null,
  setCart: (cart) => set({ cart }),
  clearCartCache: () => set({ cart: null }),
  getTotalItems: () => get().cart?.detalles.reduce((sum, item) => sum + item.cantidad, 0) ?? 0,
  getSubtotal: () => get().cart?.detalles.reduce((sum, item) => sum + Number(item.precio) * item.cantidad, 0) ?? 0,
}));
