import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";
import { CartItem } from "@/types/cart.types";

// Adaptador para que Zustand use SecureStore como almacenamiento
const secureStorage = {
  getItem: async (name: string) => {
    const value = await SecureStore.getItemAsync(name);
    return value ?? null;
  },
  setItem: async (name: string, value: string) => {
    await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name: string) => {
    await SecureStore.deleteItemAsync(name);
  },
};

interface CartState {
  items: CartItem[];

  // Acciones
  addItem: (item: CartItem) => void;
  removeItem: (idVariante: number) => void;
  updateQuantity: (idVariante: number, cantidad: number) => void;
  clearCart: () => void;

  // Getters (calculados)
  getTotalItems: () => number;
  getSubtotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (nuevo) => {
        set((state) => {
          const existente = state.items.find(
            (i) => i.idVariante === nuevo.idVariante
          );

          if (existente) {
            // Ya existe: sumar cantidades
            return {
              items: state.items.map((i) =>
                i.idVariante === nuevo.idVariante
                  ? { ...i, cantidad: i.cantidad + nuevo.cantidad }
                  : i
              ),
            };
          }

          // No existe: agregarlo
          return { items: [...state.items, nuevo] };
        });
      },

      removeItem: (idVariante) => {
        set((state) => ({
          items: state.items.filter((i) => i.idVariante !== idVariante),
        }));
      },

      updateQuantity: (idVariante, cantidad) => {
        if (cantidad <= 0) {
          // Si baja a 0 o menos, mejor eliminar
          get().removeItem(idVariante);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.idVariante === idVariante ? { ...i, cantidad } : i
          ),
        }));
      },

      clearCart: () => set({ items: [] }),

      getTotalItems: () => {
        return get().items.reduce((sum, i) => sum + i.cantidad, 0);
      },

      getSubtotal: () => {
        return get().items.reduce((sum, i) => sum + i.precio * i.cantidad, 0);
      },
    }),
    {
      name: "cart-storage",
      storage: createJSONStorage(() => secureStorage),
    }
  )
);