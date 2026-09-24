import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { getSessionItem, removeSessionItem, setSessionItem } from '@/services/sessionStorage'

const storage = {
  getItem: (name: string) => getSessionItem(name),
  setItem: (name: string, value: string) => setSessionItem(name, value),
  removeItem: (name: string) => removeSessionItem(name),
}

interface ShopState {
  selectedBranchId: number | null
  setSelectedBranchId: (id: number) => void
}

export const useShopStore = create<ShopState>()(persist(
  (set) => ({ selectedBranchId: null, setSelectedBranchId: (selectedBranchId) => set({ selectedBranchId }) }),
  { name: 'fashionstore-shop', storage: createJSONStorage(() => storage) },
))
