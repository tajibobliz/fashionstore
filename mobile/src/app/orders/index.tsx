import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { OrderCard } from "@/components/orders/OrderCard";
import { AuthenticatedHeader } from "@/components/layout/AuthenticatedHeader";
import { salesService } from "@/services/sales.service";
import { Sale } from "@/types/checkout.types";

export default function MyOrdersScreen() {
  const router = useRouter();

  const [orders, setOrders] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      setError(null);
      const data = await salesService.getMySales();
      setOrders(data);
    } catch (e) {
      const err = e as AxiosError;
      if (!err.response) {
        setError("Sin conexión con el servidor.");
      } else {
        setError("No se pudieron cargar tus pedidos.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  // Estado de carga inicial
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#e11d48" />
        <Text className="mt-3 text-gray-500">Cargando tus pedidos...</Text>
      </View>
    );
  }

  // Header común (para reutilizar en todos los estados)
  const Header = () => <AuthenticatedHeader title="Mis pedidos" />;

  // Estado de error
  if (error) {
    return (
      <View className="flex-1 bg-white">
        <Header />
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="alert-circle-outline" size={60} color="#d1d5db" />
          <Text className="mt-4 text-lg font-semibold text-gray-900">
            Algo salió mal
          </Text>
          <Text className="mt-1 text-center text-gray-500">{error}</Text>
          <View className="mt-6 w-full">
            <Button title="Reintentar" onPress={fetchOrders} />
          </View>
        </View>
      </View>
    );
  }

  // Estado vacío
  if (orders.length === 0) {
    return (
      <View className="flex-1 bg-white">
        <Header />
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="bag-outline" size={80} color="#d1d5db" />
          <Text className="mt-4 text-lg font-semibold text-gray-900">
            No tienes pedidos aún
          </Text>
          <Text className="mt-1 text-center text-gray-500">
            Cuando compres algo, aparecerá aquí.
          </Text>
          <View className="mt-6 w-full">
            <Button
              title="Explorar catálogo"
              onPress={() => router.push("/catalog" as any)}
            />
          </View>
        </View>
      </View>
    );
  }

  // Listado normal
  return (
    <View className="flex-1 bg-gray-50">
      <Header />
      <FlatList
        data={orders}
        keyExtractor={(item) => item.idVenta.toString()}
        renderItem={({ item }) => <OrderCard sale={item} />}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 20 }}
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
