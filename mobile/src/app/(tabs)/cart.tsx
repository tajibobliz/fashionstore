import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { AuthenticatedHeader } from "@/components/layout/AuthenticatedHeader";
import { CartItemCard } from "@/components/shop/CartItemCard";
import { Button } from "@/components/ui/Button";
import { cartService } from "@/services/cart.service";
import { useCartStore } from "@/stores/cartStore";
import { useShopStore } from "@/stores/shopStore";

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const branchId = useShopStore((state) => state.selectedBranchId);
  const cart = useCartStore((state) => state.cart);
  const setCart = useCartStore((state) => state.setCart);
  const subtotal = useCartStore((state) => state.getSubtotal());
  const totalItems = useCartStore((state) => state.getTotalItems());
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const refreshCart = useCallback(async () => {
    if (!branchId) { setCart(null); return; }
    setLoading(true);
    try {
      setCart(await cartService.getMyCart(branchId));
    } catch (error: any) {
      const message = error?.response?.data?.message ?? "No se pudo cargar el carrito.";
      Alert.alert("Error", Array.isArray(message) ? message.join("\n") : String(message));
    } finally { setLoading(false); }
  }, [branchId, setCart]);

  useFocusEffect(useCallback(() => { void refreshCart(); }, [refreshCart]));

  const changeQuantity = async (id: number, quantity: number) => {
    setUpdatingId(id);
    try {
      if (quantity <= 0) await cartService.removeItem(id);
      else await cartService.updateItem(id, quantity);
      await refreshCart();
    } catch (error: any) {
      const message = error?.response?.data?.message ?? "No se pudo actualizar el carrito.";
      Alert.alert("Error", Array.isArray(message) ? message.join("\n") : String(message));
    } finally { setUpdatingId(null); }
  };

  const clear = () => {
    if (!branchId) return;
    Alert.alert("Vaciar carrito", "¿Seguro que quieres eliminar todos los productos?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Vaciar", style: "destructive", onPress: async () => { await cartService.clearCart(branchId); await refreshCart(); } },
    ]);
  };

  const details = cart?.detalles ?? [];
  return (
    <View className="flex-1 bg-gray-50">
      <AuthenticatedHeader title="Carrito" />
      {!branchId ? <EmptyState icon="storefront-outline" text="Selecciona una sucursal para consultar su carrito." action="Elegir sucursal" onPress={() => router.push("/catalog" as any)} />
        : loading && !cart ? <View className="flex-1 items-center justify-center"><ActivityIndicator color="#e11d48" /></View>
        : details.length === 0 ? <EmptyState icon="cart-outline" text="Tu carrito está vacío" action="Explorar catálogo" onPress={() => router.push("/catalog" as any)} />
        : <>
          <View className="flex-row items-center justify-between bg-white px-4 py-3"><Text className="text-sm text-gray-500">{totalItems} {totalItems === 1 ? "producto" : "productos"}</Text><Pressable onPress={clear}><Text className="text-sm font-semibold text-primary-500">Vaciar</Text></Pressable></View>
          <FlatList data={details} keyExtractor={(item) => String(item.idDetalleCarrito)} renderItem={({ item }) => <CartItemCard item={item} updating={updatingId === item.idDetalleCarrito} onQuantityChange={(quantity) => void changeQuantity(item.idDetalleCarrito, quantity)} onRemove={() => void changeQuantity(item.idDetalleCarrito, 0)} />} contentContainerStyle={{ paddingTop: 12, paddingBottom: 180 }} onRefresh={() => void refreshCart()} refreshing={loading} />
          <View className="absolute bottom-0 left-0 right-0 border-t border-gray-100 bg-white px-6 pt-4" style={{ paddingBottom: insets.bottom + 16 }}><View className="mb-3 flex-row justify-between"><Text className="text-base text-gray-600">Subtotal estimado</Text><Text className="text-base font-semibold text-gray-900">Bs {subtotal.toFixed(2)}</Text></View><Button title="Continuar compra" onPress={() => router.push("/checkout" as any)} compact /></View>
        </>}
    </View>
  );
}

function EmptyState({ icon, text, action, onPress }: { icon: keyof typeof Ionicons.glyphMap; text: string; action: string; onPress: () => void }) {
  return <View className="flex-1 items-center justify-center bg-white px-6"><Ionicons name={icon} size={72} color="#d1d5db" /><Text className="mt-4 text-center text-lg font-bold text-gray-900">{text}</Text><View className="mt-6 w-full"><Button title={action} onPress={onPress} /></View></View>;
}
