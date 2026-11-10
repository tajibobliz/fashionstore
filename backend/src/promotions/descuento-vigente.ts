/**
 * Regla del descuento vigente de una prenda (sin dependencias, para probarla sola): gana el MAYOR
 * porcentaje entre las promociones del producto, de su categoría y de la temporada de su colección.
 * Es la misma condición que PromotionsService.findByProducto, pero aplicada en memoria a muchas
 * prendas a la vez.
 */
export interface PrendaParaDescuento {
  idProducto: number;
  categoria?: { idCategoria: number } | null;
  coleccion?: { temporada?: { idTemporada: number } | null } | null;
}

export interface PromocionParaDescuento {
  porcentaje: number | string;
  productos?: { idProducto: number }[];
  categorias?: { idCategoria: number }[];
  temporadas?: { idTemporada: number }[];
}

export function porcentajesPorPrenda(
  prendas: PrendaParaDescuento[],
  promociones: PromocionParaDescuento[],
) {
  const resultado = new Map<number, number>();
  for (const prenda of prendas) {
    const idCategoria = prenda.categoria?.idCategoria;
    const idTemporada = prenda.coleccion?.temporada?.idTemporada;
    let mayor = 0;
    for (const promo of promociones) {
      const aplica =
        promo.productos?.some((x) => x.idProducto === prenda.idProducto) ||
        (idCategoria !== undefined &&
          promo.categorias?.some((c) => c.idCategoria === idCategoria)) ||
        (idTemporada !== undefined &&
          promo.temporadas?.some((t) => t.idTemporada === idTemporada));
      if (aplica) mayor = Math.max(mayor, Number(promo.porcentaje));
    }
    resultado.set(prenda.idProducto, mayor);
  }
  return resultado;
}
