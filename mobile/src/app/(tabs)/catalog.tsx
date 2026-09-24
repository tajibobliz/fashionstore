import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { AuthenticatedHeader } from '@/components/layout/AuthenticatedHeader'
import { ProductCard } from '@/components/shop/ProductCard'
import { Button } from '@/components/ui/Button'
import { catalogService } from '@/services/catalog.service'
import { shopService } from '@/services/shop.service'
import { useAuthStore } from '@/stores/authStore'
import { useShopStore } from '@/stores/shopStore'
import { useCartStore } from '@/stores/cartStore'
import type { Producto } from '@/types/catalog.types'
import type { InventarioPublico, Sucursal } from '@/types/shop.types'

type Filters = { category: string | null; size: string | null; color: string | null; variant: string | null }
const EMPTY_FILTERS: Filters = { category: null, size: null, color: null, variant: null }

export default function CatalogScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const authenticated = useAuthStore((state) => state.isAuthenticated)
  const selectedBranchId = useShopStore((state) => state.selectedBranchId)
  const setSelectedBranchId = useShopStore((state) => state.setSelectedBranchId)
  const clearCartCache = useCartStore((state) => state.clearCartCache)
  const [products, setProducts] = useState<Producto[]>([])
  const [branches, setBranches] = useState<Sucursal[]>([])
  const [inventory, setInventory] = useState<InventarioPublico[]>([])
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [branchModal, setBranchModal] = useState(false)
  const [filterModal, setFilterModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const [productData, branchData, inventoryData] = await Promise.all([catalogService.getProductos(), shopService.getBranches(), shopService.getInventory()])
      const activeBranches = branchData.filter((branch) => branch.estado)
      setProducts(productData.filter((product) => product.estado))
      setBranches(activeBranches)
      setInventory(inventoryData)
      if ((!selectedBranchId || !activeBranches.some((branch) => branch.idSucursal === selectedBranchId)) && activeBranches[0]) setSelectedBranchId(activeBranches[0].idSucursal)
    } catch {
      setError('No se pudo cargar el catálogo y su disponibilidad.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [selectedBranchId, setSelectedBranchId])

  useEffect(() => { void load() }, [load])

  const branchInventory = useMemo(() => inventory.filter((item) => item.sucursal.idSucursal === selectedBranchId && item.stockDisponible > 0), [inventory, selectedBranchId])
  const inventoryByProduct = useMemo(() => {
    const map = new Map<number, InventarioPublico[]>()
    branchInventory.forEach((item) => {
      const id = item.variante.producto.idProducto
      map.set(id, [...(map.get(id) ?? []), item])
    })
    return map
  }, [branchInventory])
  const visibleProducts = useMemo(() => products.filter((product) => {
    const items = inventoryByProduct.get(product.idProducto) ?? []
    if (items.length === 0) return false
    const term = search.trim().toLowerCase()
    if (term && !product.nombre.toLowerCase().includes(term) && !items.some((item) => item.variante.sku.toLowerCase().includes(term))) return false
    if (filters.category && product.categoria?.nombre !== filters.category) return false
    if (filters.size && !items.some((item) => item.variante.talla?.nombre === filters.size)) return false
    if (filters.color && !items.some((item) => item.variante.color?.nombre === filters.color)) return false
    if (filters.variant && !items.some((item) => item.variante.sku === filters.variant)) return false
    return true
  }), [filters, inventoryByProduct, products, search])

  const selectedBranch = branches.find((branch) => branch.idSucursal === selectedBranchId)
  const options = useMemo(() => ({
    category: [...new Set(branchInventory.map((item) => item.variante.producto.categoria?.nombre).filter(Boolean))] as string[],
    size: [...new Set(branchInventory.map((item) => item.variante.talla?.nombre).filter(Boolean))] as string[],
    color: [...new Set(branchInventory.map((item) => item.variante.color?.nombre).filter(Boolean))] as string[],
    variant: [...new Set(branchInventory.map((item) => item.variante.sku))],
  }), [branchInventory])
  const activeFilters = Object.entries(filters).filter(([, value]) => value) as [keyof Filters, string][]

  const top = (
    <>
      {authenticated ? <AuthenticatedHeader title="Catálogo" /> : <View className="h-12 flex-row items-center border-b border-gray-100 px-4"><Pressable onPress={() => router.replace('/home' as any)} className="h-10 w-10 items-center justify-center"><Ionicons name="arrow-back" size={23} color="#111827" /></Pressable><Text className="ml-2 text-lg font-bold text-gray-900">Catálogo</Text></View>}
      <View className="px-3 py-2">
        <View className="flex-row gap-2">
          <Pressable onPress={() => setBranchModal(true)} className="max-w-[34%] flex-row items-center rounded-xl border border-gray-200 px-3 py-2"><Ionicons name="storefront-outline" size={17} color="#e11d48" /><Text className="ml-1 flex-1 text-xs font-semibold" numberOfLines={1}>{selectedBranch?.nombre ?? 'Sucursal'}</Text><Ionicons name="chevron-down" size={14} /></Pressable>
          <View className="flex-1 flex-row items-center rounded-xl border border-gray-200 px-3"><Ionicons name="search" size={17} color="#6b7280" /><TextInput value={search} onChangeText={setSearch} placeholder="Nombre o SKU" className="ml-2 flex-1 py-2 text-sm" /></View>
          <Pressable onPress={() => setFilterModal(true)} className="h-10 w-10 items-center justify-center rounded-xl border border-gray-200"><Ionicons name="options-outline" size={20} color="#111827" /></Pressable>
        </View>
        {activeFilters.length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">{activeFilters.map(([key, value]) => <Pressable key={key} onPress={() => setFilters((current) => ({ ...current, [key]: null }))} className="mr-2 flex-row items-center rounded-full bg-primary-50 px-3 py-1"><Text className="text-xs text-primary-600">{value}</Text><Ionicons name="close" size={13} color="#e11d48" /></Pressable>)}</ScrollView> : null}
      </View>
    </>
  )

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: authenticated ? 0 : insets.top }}>
      {top}
      {loading ? <View className="flex-1 items-center justify-center"><ActivityIndicator color="#e11d48" /></View> : error ? <View className="flex-1 items-center justify-center px-6"><Text className="mb-5 text-center text-gray-600">{error}</Text><Button title="Reintentar" onPress={() => void load()} /></View> : <FlatList data={visibleProducts} keyExtractor={(item) => item.idProducto.toString()} renderItem={({ item }) => <ProductCard producto={item} />} numColumns={2} columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }} contentContainerStyle={{ paddingTop: 4, paddingBottom: 20 }} ListEmptyComponent={<Text className="mt-16 text-center text-gray-500">No hay productos disponibles con estos filtros.</Text>} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load() }} />} />}

      <ChoiceModal visible={branchModal} title="Seleccionar sucursal" values={branches.map((branch) => ({ label: branch.nombre, value: String(branch.idSucursal) }))} selected={selectedBranchId ? String(selectedBranchId) : null} onClose={() => setBranchModal(false)} onSelect={(value) => { setSelectedBranchId(Number(value)); clearCartCache(); setFilters(EMPTY_FILTERS); setBranchModal(false) }} />
      <Modal visible={filterModal} transparent animationType="slide" onRequestClose={() => setFilterModal(false)}><View className="flex-1 justify-end bg-black/30"><View className="max-h-[75%] rounded-t-3xl bg-white p-5"><View className="mb-4 flex-row items-center justify-between"><Text className="text-xl font-bold">Filtros</Text><Pressable onPress={() => setFilterModal(false)}><Ionicons name="close" size={24} /></Pressable></View><ScrollView>{(['category', 'size', 'color', 'variant'] as const).map((key) => <View key={key} className="mb-5"><Text className="mb-2 font-semibold capitalize">{{ category: 'Categoría', size: 'Talla', color: 'Color', variant: 'Variante' }[key]}</Text><View className="flex-row flex-wrap gap-2">{options[key].map((value) => <Pressable key={value} onPress={() => setFilters((current) => ({ ...current, [key]: current[key] === value ? null : value }))} className={`rounded-full border px-3 py-2 ${filters[key] === value ? 'border-primary-500 bg-primary-50' : 'border-gray-200'}`}><Text className="text-xs">{value}</Text></Pressable>)}</View></View>)}</ScrollView><Button title="Aplicar filtros" onPress={() => setFilterModal(false)} /><View className="mt-2"><Button title="Limpiar" variant="outline" onPress={() => setFilters(EMPTY_FILTERS)} /></View></View></View></Modal>
    </View>
  )
}

function ChoiceModal({ visible, title, values, selected, onClose, onSelect }: { visible: boolean; title: string; values: { label: string; value: string }[]; selected: string | null; onClose: () => void; onSelect: (value: string) => void }) {
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View className="flex-1 justify-end bg-black/30"><View className="max-h-[65%] rounded-t-3xl bg-white p-5"><View className="mb-3 flex-row justify-between"><Text className="text-xl font-bold">{title}</Text><Pressable onPress={onClose}><Ionicons name="close" size={24} /></Pressable></View><ScrollView>{values.map((item) => <Pressable key={item.value} onPress={() => onSelect(item.value)} className="flex-row items-center border-b border-gray-100 py-4"><Text className="flex-1">{item.label}</Text>{selected === item.value ? <Ionicons name="checkmark-circle" size={22} color="#e11d48" /> : null}</Pressable>)}</ScrollView></View></View></Modal>
}
