import { api } from '../api/axios'

/**
 * Dirección absoluta de la foto de una prenda (la usan ProductImage y la descarga offline):
 * - "/tryon/…" → imagen del propio frontend (public/tryon);
 * - otra ruta relativa ("/uploads/…") → la sirve el backend;
 * - "https://…" → tal cual. Cualquier otra cosa → undefined (se muestra el icono).
 */
export function urlImagenPrenda(src?: string | null): string | undefined {
  if (!src) return undefined
  try {
    const base = src.startsWith('/tryon/') ? window.location.origin : api.defaults.baseURL
    const url = new URL(src, base)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined
  } catch {
    return undefined
  }
}

/**
 * Pide por adelantado las fotos del catálogo para verlas sin conexión: el service worker las
 * guarda en su caché de imágenes (regla "fotos-prendas" en vite.config.ts). No se espera: si
 * alguna falla, esa prenda se ve con el icono.
 */
export function precargarImagenes(fuentes: (string | null | undefined)[]) {
  for (const url of new Set(fuentes.map(urlImagenPrenda).filter((u): u is string => !!u))) {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
  }
}
