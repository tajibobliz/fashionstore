import { api } from "./api";
import { Categoria, Producto } from "@/types/catalog.types";
import { Promocion } from "@/types/promotion.types";

// Tipo mínimo local: la respuesta real de /catalog/variantes trae `producto` embebido (la entidad
// VarianteProducto lo carga eager en el backend), pero VarianteProducto en catalog.types.ts lo omite
// a propósito ("lo ignoramos aquí") para no acoplar el resto de la app a ese detalle. Se declara acá,
// solo para esta pantalla, en vez de tocar el tipo compartido.
interface VarianteConProducto {
  producto: { idProducto: number } | null;
}

export const homeService = {
  async getCategorias(): Promise<Categoria[]> {
    const { data } = await api.get<Categoria[]>("/catalog/categorias");
    return data;
  },

  /**
   * "Novedades": hasta 8 productos con imagen y con al menos una variante (o sea, comprables).
   * El listado de productos no incluye `variantes` (solo el detalle la trae), así que se cruza
   * con /catalog/variantes para saber cuáles sí tienen. Ordena por idProducto descendente como
   * proxy de "más reciente" (el backend no expone fecha de creación del producto).
   */
  async getNovedades(limit = 8): Promise<Producto[]> {
    const [productos, variantes] = await Promise.all([
      api.get<Producto[]>("/catalog/productos").then((r) => r.data),
      api.get<VarianteConProducto[]>("/catalog/variantes").then((r) => r.data),
    ]);
    const idsConVariante = new Set(
      variantes.map((v) => v.producto?.idProducto).filter((id): id is number => id != null)
    );
    return productos
      .filter((p) => p.estado && !!p.imagenUrl && idsConVariante.has(p.idProducto))
      .sort((a, b) => b.idProducto - a.idProducto)
      .slice(0, limit);
  },

  // Requiere JWT (cualquier rol autenticado); solo llamar si hay sesión.
  async getPromocionesActivas(): Promise<Promocion[]> {
    const { data } = await api.get<Promocion[]>("/promotions/activas");
    return data;
  },

  // Recomendaciones personalizadas del usuario logueado. Requiere JWT; solo llamar si hay sesión.
  async getRecomendaciones(limit = 8): Promise<Producto[]> {
    const { data } = await api.get<Producto[]>("/ai/recomendaciones", { params: { limit } });
    return data;
  },
};
