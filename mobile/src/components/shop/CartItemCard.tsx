import { View, Text, Image, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CartItem } from "@/types/cart.types";
import { useCartStore } from "@/stores/cartStore";

interface Props {
  item: CartItem;
}

export function CartItemCard({ item }: Props) {
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);

  const subtotal = (item.precio * item.cantidad).toFixed(2);

  return (
    <View className="mx-4 mb-3 flex-row rounded-2xl bg-white p-3">
      {/* Imagen */}
      {item.imagenUrl ? (
        <Image
          source={{ uri: item.imagenUrl }}
          className="h-24 w-20 rounded-lg bg-gray-100"
          resizeMode="cover"
        />
      ) : (
        <View className="h-24 w-20 items-center justify-center rounded-lg bg-gray-100">
          <Ionicons name="image-outline" size={28} color="#9ca3af" />
        </View>
      )}

      {/* Info */}
      <View className="ml-3 flex-1 justify-between">
        <View>
          <View className="flex-row items-start justify-between">
            <Text
              className="flex-1 pr-2 text-sm font-semibold text-gray-900"
              numberOfLines={2}
            >
              {item.nombre}
            </Text>
            <Pressable onPress={() => removeItem(item.idVariante)}>
              <Ionicons name="close" size={20} color="#9ca3af" />
            </Pressable>
          </View>

          {/* Talla + Color */}
          <View className="mt-1 flex-row items-center gap-2">
            {item.talla && (
              <Text className="text-xs text-gray-500">Talla: {item.talla}</Text>
            )}
            {item.color && item.colorHex && (
              <View className="flex-row items-center gap-1">
                <View
                  className="h-3 w-3 rounded-full border border-gray-200"
                  style={{ backgroundColor: item.colorHex }}
                />
                <Text className="text-xs text-gray-500">{item.color}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Precio + controles de cantidad */}
        <View className="mt-2 flex-row items-center justify-between">
          <Text className="text-base font-bold text-primary-500">
            Bs {subtotal}
          </Text>

          <View className="flex-row items-center rounded-full border border-gray-200">
            <Pressable
              onPress={() =>
                updateQuantity(item.idVariante, item.cantidad - 1)
              }
              className="h-8 w-8 items-center justify-center"
            >
              <Ionicons name="remove" size={16} color="#111827" />
            </Pressable>
            <Text className="min-w-[24px] text-center text-sm font-semibold text-gray-900">
              {item.cantidad}
            </Text>
            <Pressable
              onPress={() =>
                updateQuantity(item.idVariante, item.cantidad + 1)
              }
              className="h-8 w-8 items-center justify-center"
            >
              <Ionicons name="add" size={16} color="#111827" />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}