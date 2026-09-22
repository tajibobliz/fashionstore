import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { reservationsService } from "@/services/reservations.service";
import { Reservation, EstadoReserva } from "@/types/reservation.types";

type EstadoConfig = {
  label: string;
  bg: string;
  text: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
};

const ESTADO_CONFIG: Record<EstadoReserva, EstadoConfig> = {
  PENDIENTE: {
    label: "Pendiente",
    bg: "bg-amber-100",
    text: "text-amber-800",
    icon: "time-outline",
    description:
      "Estamos preparando tu reserva. Te avisaremos cuando esté lista.",
  },
  PREPARADA: {
    label: "Lista para probar",
    bg: "bg-blue-100",
    text: "text-blue-800",
    icon: "checkmark-done-outline",
    description:
      "Tu reserva está lista. Acércate a la sucursal para probártela.",
  },
  ATENDIDA: {
    label: "Atendida",
    bg: "bg-green-100",
    text: "text-green-800",
    icon: "checkmark-circle-outline",
    description: "Esta reserva ya fue atendida en la sucursal.",
  },
  CANCELADA: {
    label: "Cancelada",
    bg: "bg-gray-200",
    text: "text-gray-600",
    icon: "close-circle-outline",
    description: "Esta reserva fue cancelada.",
  },
};

export default function ReservationDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const fetchReservation = async () => {
    try {
      const data = await reservationsService.getById(Number(id));
      setReservation(data);
    } catch (e) {
      const err = e as AxiosError;
      setError(
        err.response?.status === 404
          ? "Reserva no encontrada."
          : "No se pudo cargar la reserva."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservation();
  }, [id]);

  const handleCancel = () => {
    Alert.alert(
      "Cancelar reserva",
      "¿Seguro que quieres cancelar esta reserva? El stock volverá a estar disponible.",
      [
        { text: "No", style: "cancel" },
        {
          text: "Sí, cancelar",
          style: "destructive",
          onPress: async () => {
            setCancelling(true);
            try {
              const updated = await reservationsService.cancel(Number(id));
              setReservation(updated);
              Alert.alert("Cancelada", "Tu reserva fue cancelada.");
            } catch (e: any) {
              const msg =
                e?.response?.data?.message ?? "No se pudo cancelar la reserva.";
              Alert.alert(
                "Error",
                Array.isArray(msg) ? msg.join("\n") : String(msg)
              );
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#e11d48" />
      </View>
    );
  }

  if (error || !reservation) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="mb-4 text-lg font-semibold text-gray-900">
          {error ?? "Reserva no encontrada"}
        </Text>
        <View className="w-full">
          <Button title="Volver" onPress={() => router.back()} variant="outline" />
        </View>
      </View>
    );
  }

  const config = ESTADO_CONFIG[reservation.estado];
  const fecha = new Date(reservation.fechaReserva);
  const fechaFormateada = fecha.toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const horaFormateada = fecha.toLocaleTimeString("es-BO", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Solo se puede cancelar si está PENDIENTE o PREPARADA
  const puedeCancelar =
    reservation.estado === "PENDIENTE" || reservation.estado === "PREPARADA";

  return (
    <View className="flex-1 bg-gray-50">
      <View
        className="flex-row items-center bg-white px-4 pb-3 pt-2"
        style={{ paddingTop: insets.top + 8 }}
      >
        <Pressable onPress={() => router.back()} className="mr-3">
          <Ionicons name="arrow-back" size={26} color="#111827" />
        </Pressable>
        <Text className="text-xl font-bold text-gray-900">
          Reserva #{reservation.idReserva}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="mt-3 bg-white px-5 py-4">
          <View
            className={`flex-row items-center self-start rounded-full px-3 py-2 ${config.bg}`}
          >
            <Ionicons
              name={config.icon}
              size={16}
              color={
                reservation.estado === "PREPARADA"
                  ? "#1e40af"
                  : reservation.estado === "ATENDIDA"
                  ? "#16a34a"
                  : reservation.estado === "PENDIENTE"
                  ? "#b45309"
                  : "#4b5563"
              }
            />
            <Text className={`ml-1.5 text-sm font-semibold ${config.text}`}>
              {config.label}
            </Text>
          </View>
          <Text className="mt-3 text-sm text-gray-600">
            {config.description}
          </Text>
        </View>

        <View className="mt-3 bg-white px-5 py-4">
          <Text className="text-xs uppercase tracking-wider text-gray-500">
            Código
          </Text>
          <Text className="mt-1 text-sm font-mono text-gray-900" selectable>
            {reservation.codigo}
          </Text>
          <Text className="mt-3 text-xs uppercase tracking-wider text-gray-500">
            Fecha de reserva
          </Text>
          <Text className="mt-1 text-sm text-gray-900">
            {fechaFormateada} · {horaFormateada}
          </Text>
        </View>

        <View className="mt-3 bg-white px-5 py-4">
          <Text className="mb-2 text-xs uppercase tracking-wider text-gray-500">
            Retiro en sucursal
          </Text>
          <View className="flex-row items-start">
            <Ionicons name="location" size={20} color="#e11d48" />
            <View className="ml-2 flex-1">
              <Text className="text-base font-semibold text-gray-900">
                {reservation.sucursal.nombre}
              </Text>
              <Text className="text-sm text-gray-500">
                {reservation.sucursal.direccion} ·{" "}
                {reservation.sucursal.ciudad.nombre}
              </Text>
              {reservation.sucursal.telefono && (
                <Text className="mt-1 text-sm text-gray-500">
                  Tel: {reservation.sucursal.telefono}
                </Text>
              )}
            </View>
          </View>
        </View>

        <View className="mt-3 bg-white px-5 py-4">
          <Text className="mb-3 text-xs uppercase tracking-wider text-gray-500">
            Productos ({reservation.detalles.length})
          </Text>
          {reservation.detalles.map((d) => (
            <View
              key={d.idDetalleReserva}
              className="mb-3 flex-row border-b border-gray-100 pb-3"
            >
              {d.variante.producto.imagenUrl ? (
                <Image
                  source={{ uri: d.variante.producto.imagenUrl }}
                  className="h-16 w-14 rounded-lg bg-gray-100"
                  resizeMode="cover"
                />
              ) : (
                <View className="h-16 w-14 items-center justify-center rounded-lg bg-gray-100">
                  <Ionicons name="image-outline" size={20} color="#9ca3af" />
                </View>
              )}
              <View className="ml-3 flex-1 justify-center">
                <Text
                  className="text-sm font-semibold text-gray-900"
                  numberOfLines={1}
                >
                  {d.variante.producto.nombre}
                </Text>
                <Text className="text-xs text-gray-500">
                  {d.variante.talla && `Talla ${d.variante.talla.nombre}`}
                  {d.variante.talla && d.variante.color ? " · " : ""}
                  {d.variante.color?.nombre} × {d.cantidad}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {puedeCancelar && (
          <View className="mt-4 px-5">
            <Button
              title={cancelling ? "Cancelando..." : "Cancelar reserva"}
              onPress={handleCancel}
              loading={cancelling}
              variant="outline"
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}