import * as SecureStore from "expo-secure-store";

/**
 * Tienda (empresa del SaaS) con la que trabaja la app. Se identifica por su "slug"
 * (p. ej. "urban-step"). Vacío = FashionStore, la tienda por defecto.
 *
 * - Sin sesión, la API recibe el header `X-Tenant` para mostrar el catálogo de esa tienda.
 * - Con sesión, el backend usa la empresa del token, así que este valor solo es informativo.
 */
const KEY = "tienda_slug";
let actual: string | null = null;
let cargado = false;

export const tienda = {
  async cargar() {
    if (cargado) return actual;
    actual = (await SecureStore.getItemAsync(KEY)) || null;
    cargado = true;
    return actual;
  },
  get: () => actual,
  async guardar(slug: string | null) {
    actual = slug?.trim().toLowerCase() || null;
    cargado = true;
    if (actual) await SecureStore.setItemAsync(KEY, actual);
    else await SecureStore.deleteItemAsync(KEY);
  },
};

/** Normaliza lo que escribe la persona: "Urban Step" → "urban-step". */
export function slugDeTienda(texto: string) {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
