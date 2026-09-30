import type { Producto, TipoPrendaVestidor, Variante } from '../../types/catalog'

const SUPPORTED_TRY_ON_GARMENT_TYPES = [
  'GORRA',
  'SOMBRERO',
  'CAMISA',
  'BLUSA',
  'TOP',
  'PANTALON',
  'VESTIDO_CORTO',
  'VESTIDO_LARGO',
  'FALDA_CORTA',
  'FALDA_LARGA',
  'COLLAR',
  'CARTERA',
  'BUFANDA',
  'VESTIDO',
  'FALDA',
] as const satisfies readonly TipoPrendaVestidor[]

export type ResolvedTryOnGarmentType = typeof SUPPORTED_TRY_ON_GARMENT_TYPES[number] | 'lentes'

function isSupportedGarmentType(value: TipoPrendaVestidor | null | undefined): value is typeof SUPPORTED_TRY_ON_GARMENT_TYPES[number] {
  return SUPPORTED_TRY_ON_GARMENT_TYPES.some(type => type === value)
}

export function resolveTryOnAsset(producto: Producto, variante?: Variante | null) {
  return variante?.imagenVestidorUrl?.trim()
    || producto.imagenVestidorUrl?.trim()
    || producto.imagenTryOn?.trim()
    || null
}

export function resolveTryOnGarmentType(producto: Producto): ResolvedTryOnGarmentType | null {
  if (isSupportedGarmentType(producto.tipoPrendaVestidor)) return producto.tipoPrendaVestidor

  if (producto.tipoTryOn === 'gorra') return 'GORRA'
  if (producto.tipoTryOn === 'polera') return 'TOP'
  if (producto.tipoTryOn === 'lentes') return 'lentes'
  return null
}
