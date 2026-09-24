import { Image, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { CartItemBackend } from "@/types/checkout.types";

interface Props {
  item: CartItemBackend;
  updating?: boolean;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}

export function CartItemCard({ item, updating, onQuantityChange, onRemove }: Props) {
  const variant = item.variante;
  const product = variant.producto;
  const subtotal = (Number(item.precio) * item.cantidad).toFixed(2);

  return (
    <View className="mx-4 mb-3 flex-row rounded-2xl bg-white p-3">
      {product.imagenUrl ? <Image source={{ uri: product.imagenUrl }} className="h-24 w-20 rounded-lg bg-gray-100" resizeMode="cover" /> : <View className="h-24 w-20 items-center justify-center rounded-lg bg-gray-100"><Ionicons name="image-outline" size={28} color="#9ca3af" /></View>}
      <View className="ml-3 flex-1 justify-between">
        <View>
          <View className="flex-row items-start justify-between">
            <Text className="flex-1 pr-2 text-sm font-semibold text-gray-900" numberOfLines={2}>{product.nombre}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Eliminar producto" disabled={updating} onPress={onRemove}><Ionicons name="close" size={20} color="#9ca3af" /></Pressable>
          </View>
          <Text className="mt-1 text-xs text-gray-500">{variant.talla ? `Talla: ${variant.talla.nombre}` : ""}{variant.talla && variant.color ? " · " : ""}{variant.color?.nombre ?? ""}</Text>
        </View>
        <View className="mt-2 flex-row items-center justify-between">
          <Text className="text-base font-bold text-primary-500">Bs {subtotal}</Text>
          <View className="flex-row items-center rounded-full border border-gray-200">
            <Pressable disabled={updating} onPress={() => onQuantityChange(item.cantidad - 1)} className="h-8 w-8 items-center justify-center"><Ionicons name="remove" size={16} color="#111827" /></Pressable>
            <Text className="min-w-[24px] text-center text-sm font-semibold text-gray-900">{item.cantidad}</Text>
            <Pressable disabled={updating} onPress={() => onQuantityChange(item.cantidad + 1)} className="h-8 w-8 items-center justify-center"><Ionicons name="add" size={16} color="#111827" /></Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}
