import { api } from '@/services/api'
import type { InventarioPublico, Sucursal } from '@/types/shop.types'

export const shopService = {
  async getBranches(): Promise<Sucursal[]> {
    const { data } = await api.get<Sucursal[]>('/branches/sucursales')
    return data
  },

  async getInventory(): Promise<InventarioPublico[]> {
    const { data } = await api.get<InventarioPublico[]>('/inventory/inventarios')
    return data
  },
}
