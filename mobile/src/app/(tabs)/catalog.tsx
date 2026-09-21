import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AxiosError } from "axios";
import { ProductCard } from "@/components/shop/ProductCard";
import { Button } from "@/components/ui/Button";
import { catalogService } from "@/services/catalog.service";
import { Producto } from "@/types/catalog.types";

export default function CatalogScreen() {
  const insets = useSafeAreaInsets();

  // Estados de la pantalla
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);      // primera carga
  const [refreshing, setRefreshing] = useState(false); // pull-to-refresh
  const [error, setError] = useState<string | null>(null);

  // Función para traer productos del backend
  const fetchProductos = useCallback(async () => {
    try {
      setError(null);
      const data = await catalogService.getProductos();
      // Filtramos productos activos (estado true)
      const activos = data.filter((p) => p.estado);
      setProductos(activos);
    } catch (e) {
      const err = e as AxiosError;
      if (!err.response) {
        setError("Sin conexión con el servidor. Revisa tu WiFi.");
      } else {
        setError("No se pudieron cargar los productos.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Cargar al montar la pantalla
  useEffect(() => {
    fetchProductos();
  }, [fetchProductos]);

  // Pull-to-refresh (deslizar hacia abajo para recargar)
  const onRefresh = () => {
    setRefreshing(true);
    fetchProductos();
  };

  // 1) Cargando por primera vez
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#e11d48" />
        <Text className="mt-3 text-gray-500">Cargando catálogo...</Text>
      </View>
    );
  }

  // 2) Error de carga
  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="mb-2 text-lg font-semibold text-gray-900">
          Algo salió mal
        </Text>
        <Text className="mb-6 text-center text-gray-500">{error}</Text>
        <View className="w-full">
          <Button title="Reintentar" onPress={fetchProductos} />
        </View>
      </View>
    );
  }

  // 3) No hay productos
  if (productos.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="mb-2 text-lg font-semibold text-gray-900">
          Sin productos aún
        </Text>
        <Text className="text-center text-gray-500">
          Pronto tendremos novedades para ti.
        </Text>
      </View>
    );
  }

  // 4) Listado normal
  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      <View className="px-4 pb-2 pt-4">
        <Text className="text-3xl font-bold text-gray-900">Catálogo</Text>
        <Text className="mt-1 text-sm text-gray-500">
          {productos.length} {productos.length === 1 ? "producto" : "productos"}
        </Text>
      </View>

      <FlatList
        data={productos}
        keyExtractor={(item) => item.idProducto.toString()}
        renderItem={({ item }) => <ProductCard producto={item} />}
        numColumns={2}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#e11d48"
            colors={["#e11d48"]}
          />
        }
      />
    </View>
  );
}