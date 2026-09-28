import { Image, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Producto } from "@/types/catalog.types";

const CARD_WIDTH = 160;

export function ProductCardMini({ producto }: { producto: Producto }) {
  const router = useRouter();
  const precio = Number(producto.precio).toFixed(2);

  return (
    <Pressable
      onPress={() => router.push(`/product/${producto.idProducto}` as any)}
      className="mr-4 overflow-hidden rounded-2xl bg-white"
      style={{
        width: CARD_WIDTH,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
      }}
    >
      <Image
        source={{ uri: producto.imagenUrl! }}
        style={{ width: CARD_WIDTH, height: CARD_WIDTH }}
        className="bg-gray-100"
        resizeMode="cover"
      />
      <View className="p-3">
        <Text className="text-sm font-medium text-gray-900" numberOfLines={1}>
          {producto.nombre}
        </Text>
        <Text className="mt-1 text-base font-bold text-primary-500">Bs {precio}</Text>
      </View>
    </Pressable>
  );
}
