import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

/**
 * Sucursal elegida por la clienta para reservar y comprar. Reemplaza al antiguo
 * DEFAULT_SUCURSAL_ID fijo: en el SaaS cada empresa tiene sus propias sucursales.
 */
interface SucursalState {
  idSucursal: number | null;
  nombre: string | null;
  elegir: (idSucursal: number, nombre: string) => Promise<void>;
  limpiar: () => Promise<void>;
  cargar: () => Promise<void>;
}

const KEY = "sucursal_elegida";

export const useSucursalStore = create<SucursalState>((set) => ({
  idSucursal: null,
  nombre: null,

  elegir: async (idSucursal, nombre) => {
    set({ idSucursal, nombre });
    await SecureStore.setItemAsync(KEY, JSON.stringify({ idSucursal, nombre }));
  },

  limpiar: async () => {
    set({ idSucursal: null, nombre: null });
    await SecureStore.deleteItemAsync(KEY);
  },

  cargar: async () => {
    try {
      const guardada = await SecureStore.getItemAsync(KEY);
      if (guardada) set(JSON.parse(guardada));
    } catch {
      // Sin sucursal guardada: se elige al reservar o comprar.
    }
  },
}));
