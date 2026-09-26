import { api } from "./api";
import { Producto } from "@/types/catalog.types";

export const catalogService = {
  // Lista todos los productos del catálogo
  async getProductos(idSucursal?: number): Promise<Producto[]> {
    const { data } = await api.get<Producto[]>("/catalog/productos", { params: idSucursal ? { idSucursal } : undefined });
    return data;
  },

  // Obtiene el detalle de un producto por su id
  async getProductoById(id: number, idSucursal?: number): Promise<Producto> {
    const { data } = await api.get<Producto>(`/catalog/productos/${id}`, { params: idSucursal ? { idSucursal } : undefined });
    return data;
  },
};
