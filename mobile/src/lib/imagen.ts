import { Image } from "expo-image";
import { API_URL } from "@/config/env";
import { IMAGENES_TRYON } from "@/features/tryon/vestidorWeb.generated";

/**
 * Dirección que entiende <Image> para la foto de una prenda (igual que ProductImage de la web):
 * - "/tryon/…"  → imagen incluida en la app (las mismas del vestidor, en base64);
 * - "https://…" o "data:…" → tal cual;
 * - otra ruta relativa ("/uploads/…") → la sirve el backend.
 * React Native no resuelve rutas relativas: sin esto la foto quedaba en blanco.
 */
export function urlImagen(ruta?: string | null): string | undefined {
  if (!ruta) return undefined;
  if (IMAGENES_TRYON[ruta]) return IMAGENES_TRYON[ruta];
  if (/^(https?:|data:|file:)/i.test(ruta)) return ruta;
  return `${API_URL.replace(/\/$/, "")}${ruta.startsWith("/") ? "" : "/"}${ruta}`;
}

/**
 * Descarga por adelantado las fotos del catálogo a la caché de disco de expo-image, para verlas
 * sin conexión (pantalla offline). Las de /tryon ya vienen dentro de la app. No se espera ni
 * lanza: si alguna falla, esa prenda se ve con su inicial.
 */
export function precargarFotos(rutas: (string | null | undefined)[]) {
  const urls = [...new Set(rutas.map(urlImagen).filter((u): u is string => !!u && /^https?:/i.test(u)))];
  if (urls.length) void Image.prefetch(urls, "disk").catch(() => false);
}
