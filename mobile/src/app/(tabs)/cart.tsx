import { View, Text, FlatList, Alert, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { CartItemCard } from "@/components/shop/CartItemCard";
import { useCartStore } from "@/stores/cartStore";

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);
  const subtotal = useCartStore((state) => state.getSubtotal());
  const totalItems = useCartStore((state) => state.getTotalItems());

  const handleClearCart = () => {
    Alert.alert(
      "Vaciar carrito",
      "¿Seguro que quieres eliminar todos los productos?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Vaciar",
          style: "destructive",
          onPress: clearCart,
        },
      ]
    );
  };

  const handleCheckout = () => {
    router.push("/checkout" as any);
  };

  // Estado vacío
  if (items.length === 0) {
    return (
      <View
        className="flex-1 items-center justify-center bg-white px-6"
        style={{ paddingTop: insets.top }}
      >
        <Ionicons name="cart-outline" size={80} color="#d1d5db" />
        <Text className="mt-4 text-xl font-bold text-gray-900">
          Tu carrito está vacío
        </Text>
        <Text className="mt-1 text-center text-gray-500">
          Agrega productos para verlos aquí.
        </Text>
        <View className="mt-6 w-full">
          <Button
            title="Explorar catálogo"
            onPress={() => router.push("/catalog" as any)}
          />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center justify-between bg-white px-4 pb-3 pt-4">
        <View>
          <Text className="text-2xl font-bold text-gray-900">Mi carrito</Text>
          <Text className="text-sm text-gray-500">
            {totalItems} {totalItems === 1 ? "producto" : "productos"}
          </Text>
        </View>
        <Text
          onPress={handleClearCart}
          className="text-sm font-semibold text-primary-500"
        >
          Vaciar
        </Text>
      </View>

      {/* Lista de items */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.idVariante.toString()}
        renderItem={({ item }) => <CartItemCard item={item} />}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 200 }}
      />

      {/* Resumen y botón fijo abajo */}
      <View
        className="absolute bottom-0 left-0 right-0 border-t border-gray-100 bg-white px-6 pt-4"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <View className="mb-3 flex-row justify-between">
          <Text className="text-base text-gray-600">Subtotal</Text>
          <Text className="text-base font-semibold text-gray-900">
            Bs {subtotal.toFixed(2)}
          </Text>
        </View>
        <View className="mb-4 flex-row justify-between">
          <Text className="text-lg font-bold text-gray-900">Total</Text>
          <Text className="text-lg font-bold text-primary-500">
            Bs {subtotal.toFixed(2)}
          </Text>
        </View>
        <Button title="Ir a pagar" onPress={handleCheckout} />
      </View>
    </View>
  );
}