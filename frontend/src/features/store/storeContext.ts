import { createContext, useContext } from 'react'

export interface StoreInfo {
  /** null = tienda por defecto (FashionStore, rutas antiguas sin /t/). */
  slug: string | null
  nombre: string
  /** Prefijo de rutas de la tienda: '' o '/t/<slug>'. */
  base: string
}

export const DEFAULT_STORE: StoreInfo = { slug: null, nombre: 'Fashionstore', base: '' }
export const StoreContext = createContext<StoreInfo>(DEFAULT_STORE)
export const useStore = () => useContext(StoreContext)
