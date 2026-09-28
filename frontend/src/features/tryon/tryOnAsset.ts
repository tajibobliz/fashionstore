import type { Producto, TipoPrendaVestidor, Variante } from '../../types/catalog'

export type ResolvedTryOnGarmentType = Extract<TipoPrendaVestidor, 'GORRA' | 'CAMISA' | 'BLUSA' | 'TOP'> | 'lentes'

export function resolveTryOnAsset(producto: Producto, variante?: Variante | null) {
  return variante?.imagenVestidorUrl?.trim()
    || producto.imagenVestidorUrl?.trim()
    || producto.imagenTryOn?.trim()
    || null
}

export function resolveTryOnGarmentType(producto: Producto): ResolvedTryOnGarmentType | null {
  if (producto.tipoPrendaVestidor === 'GORRA'
    || producto.tipoPrendaVestidor === 'CAMISA'
    || producto.tipoPrendaVestidor === 'BLUSA'
    || producto.tipoPrendaVestidor === 'TOP') return producto.tipoPrendaVestidor

  if (producto.tipoTryOn === 'gorra') return 'GORRA'
  if (producto.tipoTryOn === 'polera') return 'TOP'
  if (producto.tipoTryOn === 'lentes') return 'lentes'
  return null
}
