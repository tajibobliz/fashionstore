import { Producto } from "./catalog.types";

export interface Promocion {
  idPromocion: number;
  nombre: string;
  porcentaje: number;
  fechaInicio: string | null;
  fechaFin: string | null;
  estado: boolean;
  // Eager en el backend (tabla promocion_producto); puede venir vacío si la promo aplica por
  // categoría/temporada en vez de por producto puntual.
  productos?: Producto[];
}
