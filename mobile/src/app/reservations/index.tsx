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
import { ReservationCard } from "@/components/orders/ReservationCard";
import { AuthenticatedHeader } from "@/components/layout/AuthenticatedHeader";
import { reservationsService } from "@/services/reservations.service";
import { Reservation } from "@/types/reservation.types";

export default function MyReservationsScreen() {
  const router = useRouter();

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReservations = useCallback(async () => {
    try {
      setError(null);
      const data = await reservationsService.getMine();
      // Ordenar de más reciente a más antigua
      const sorted = data.sort(
        (a, b) =>
          new Date(b.fechaReserva).getTime() -
          new Date(a.fechaReserva).getTime()
      );
      setReservations(sorted);
    } catch (e) {
      const err = e as AxiosError;
      if (!err.response) {
        setError("Sin conexión con el servidor.");
      } else {
        setError("No se pudieron cargar tus reservas.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchReservations();
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#e11d48" />
        <Text className="mt-3 text-gray-500">Cargando tus reservas...</Text>
      </View>
    );
  }

  const Header = () => <AuthenticatedHeader title="Mis reservas" />;

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
            <Button title="Reintentar" onPress={fetchReservations} />
          </View>
        </View>
      </View>
    );
  }

  if (reservations.length === 0) {
    return (
      <View className="flex-1 bg-white">
        <Header />
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="calendar-outline" size={80} color="#d1d5db" />
          <Text className="mt-4 text-lg font-semibold text-gray-900">
            No tienes reservas
          </Text>
          <Text className="mt-1 text-center text-gray-500">
            Reserva productos para probártelos en la sucursal antes de
            comprarlos.
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

  return (
    <View className="flex-1 bg-gray-50">
      <Header />
      <FlatList
        data={reservations}
        keyExtractor={(item) => item.idReserva.toString()}
        renderItem={({ item }) => <ReservationCard reservation={item} />}
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
