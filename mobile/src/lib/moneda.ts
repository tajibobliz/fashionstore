import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { api } from "@/services/api";

/**
 * Montos en la moneda de la TIENDA (empresa del SaaS), igual que la web
 * (frontend/src/utils/money.ts): Urban Step puede vender en USD y FashionStore en Bs.
 *
 * La moneda se lee de `/saas/tiendas/:slug` al abrir la app y al iniciar sesión, y se guarda en el
 * teléfono para mostrar bien los precios también sin conexión.
 */
export interface Moneda {
  codigo: string;
  simbolo: string;
  decimales: number;
}

export const MONEDAS: Moneda[] = [
  { codigo: "BOB", simbolo: "Bs", decimales: 2 },
  { codigo: "USD", simbolo: "US$", decimales: 2 },
  { codigo: "ARS", simbolo: "$", decimales: 2 },
  { codigo: "BRL", simbolo: "R$", decimales: 2 },
  { codigo: "CLP", simbolo: "$", decimales: 0 },
  { codigo: "COP", simbolo: "$", decimales: 0 },
  { codigo: "EUR", simbolo: "€", decimales: 2 },
  { codigo: "MXN", simbolo: "$", decimales: 2 },
  { codigo: "PEN", simbolo: "S/", decimales: 2 },
  { codigo: "PYG", simbolo: "₲", decimales: 0 },
];

const POR_DEFECTO = "BOB";
const KEY = "tienda_moneda";
const valida = (codigo?: string | null) => (MONEDAS.some((m) => m.codigo === codigo) ? codigo! : POR_DEFECTO);

interface MonedaState {
  codigo: string;
  /** Lee la moneda guardada en el teléfono (sirve sin conexión). */
  cargar: () => Promise<void>;
  /** Consulta la moneda de la tienda en el backend; si no hay red, se queda la guardada. */
  actualizar: (slug: string | null) => Promise<void>;
}

export const useMonedaStore = create<MonedaState>((set) => ({
  codigo: POR_DEFECTO,
  cargar: async () => {
    const guardada = await SecureStore.getItemAsync(KEY).catch(() => null);
    if (guardada) set({ codigo: valida(guardada) });
  },
  actualizar: async (slug) => {
    try {
      const { data } = await api.get<{ moneda?: string }>(`/saas/tiendas/${slug || "fashionstore"}`);
      const codigo = valida(data?.moneda);
      set({ codigo });
      await SecureStore.setItemAsync(KEY, codigo);
    } catch {
      // Sin conexión o tienda no encontrada: se mantiene la última moneda conocida.
    }
  },
}));

export function moneda(codigo: string = useMonedaStore.getState().codigo): Moneda {
  return MONEDAS.find((m) => m.codigo === codigo) ?? MONEDAS[0];
}

/** "Bs 1.234,50" · "US$ 19,00" · "$ 15.990". */
export function formatMoney(valor: number | string | null | undefined, codigo?: string) {
  const m = moneda(codigo);
  const n = Number(valor ?? 0);
  const numero = (Number.isFinite(n) ? n : 0).toLocaleString("es-BO", {
    minimumFractionDigits: m.decimales,
    maximumFractionDigits: m.decimales,
  });
  return `${m.simbolo} ${numero}`;
}

/** Formateador que se actualiza cuando cambia la moneda de la tienda (vuelve a dibujar la pantalla). */
export function useFormatMoney() {
  const codigo = useMonedaStore((s) => s.codigo);
  return (valor: number | string | null | undefined) => formatMoney(valor, codigo);
}
