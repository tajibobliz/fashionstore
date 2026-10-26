import { api } from "./api";

export interface Sucursal {
  idSucursal: number;
  nombre: string;
  direccion?: string;
  estado?: boolean;
}

export const branchesService = {
  /** Sucursales activas de la tienda (público: con sesión, las de la empresa del usuario). */
  async getAll(): Promise<Sucursal[]> {
    const { data } = await api.get<Sucursal[]>("/branches/sucursales");
    return data.filter((s) => s.estado !== false);
  },
};
