import { View, Text, Image, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Producto } from "@/types/catalog.types";
import { Ionicons } from "@expo/vector-icons";

// Imagen genérica cuando el producto no tiene foto
interface Props {
  producto: Producto;
}

export function ProductCard({ producto }: Props) {
  const router = useRouter();

  // Convertir precio string a número y formatearlo
  const precioFormateado = Number(producto.precio).toFixed(2);

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
      {producto.imagenUrl ? (
        <Image source={{ uri: producto.imagenUrl }} className="h-48 w-full bg-gray-100" resizeMode="cover" />
      ) : (
        <View className="h-48 w-full items-center justify-center bg-gray-100">
          <Ionicons name="image-outline" size={44} color="#9ca3af" />
          <Text className="mt-2 text-xs text-gray-400">Sin imagen</Text>
        </View>
      )}

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
          Bs {precioFormateado}
        </Text>
      </View>
    </Pressable>
  );
}
