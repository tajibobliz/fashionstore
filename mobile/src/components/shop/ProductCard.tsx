import { View, Text, Image, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Producto } from "@/types/catalog.types";
import { useFormatMoney } from "@/lib/moneda";
import { urlImagen } from "@/lib/imagen";

// Imagen genérica cuando el producto no tiene foto
const PLACEHOLDER_IMAGE =
  "https://placehold.co/400x500/f3f4f6/9ca3af?text=Sin+imagen";

interface Props {
  producto: Producto;
}

export function ProductCard({ producto }: Props) {
  const fmt = useFormatMoney();
  const router = useRouter();

  // Convertir precio string a número y formatearlo

  const handlePress = () => {
    router.push(`/product/${producto.idProducto}` as any);
  };

  return (
    <Pressable
      onPress={handlePress}
      className="mb-4 flex-1 overflow-hidden rounded-2xl bg-white"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
      }}
    >
      <Image
        source={{ uri: urlImagen(producto.imagenUrl) ?? PLACEHOLDER_IMAGE }}
        className="h-48 w-full bg-gray-100"
        resizeMode="cover"
      />

      <View className="p-3">
        <Text
          className="text-sm font-medium text-gray-900"
          numberOfLines={1}
        >
          {producto.nombre}
        </Text>

        {producto.categoria && (
          <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={1}>
            {producto.categoria.nombre}
          </Text>
        )}

        <Text className="mt-2 text-base font-bold text-primary-500">
          {fmt(producto.precio)}
        </Text>
      </View>
    </Pressable>
  );
}