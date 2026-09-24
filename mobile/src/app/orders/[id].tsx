import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { AuthenticatedHeader } from "@/components/layout/AuthenticatedHeader";
import { salesService } from "@/services/sales.service";
import { Sale, EstadoVenta } from "@/types/checkout.types";

type EstadoConfig = {
  label: string;
  bg: string;
  text: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const ESTADO_CONFIG: Record<EstadoVenta, EstadoConfig> = {
  PENDIENTE: {
    label: "Pendiente de pago",
    bg: "bg-amber-100",
    text: "text-amber-800",
    icon: "time-outline",
  },
  PAGADA: {
    label: "Pagada",
    bg: "bg-green-100",
    text: "text-green-800",
    icon: "checkmark-circle-outline",
  },
  CANCELADA: {
    label: "Cancelada",
    bg: "bg-gray-200",
    text: "text-gray-600",
    icon: "close-circle-outline",
  },
  DEVUELTA_PARCIAL: {
    label: "Devuelta parcial",
    bg: "bg-orange-100",
    text: "text-orange-800",
    icon: "return-down-back-outline",
  },
  DEVUELTA: {
    label: "Devuelta",
    bg: "bg-red-100",
    text: "text-red-800",
    icon: "return-down-back-outline",
  },
};

export default function OrderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [order, setOrder] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const data = await salesService.getSaleById(Number(id));
        setOrder(data);
      } catch (e) {
        const err = e as AxiosError;
        setError(
          err.response?.status === 404
            ? "Pedido no encontrado."
            : "No se pudo cargar el pedido."
        );
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#e11d48" />
      </View>
    );
  }

  if (error || !order) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="mb-4 text-lg font-semibold text-gray-900">
          {error ?? "Pedido no encontrado"}
        </Text>
        <View className="w-full">
          <Button title="Volver" onPress={() => router.back()} variant="outline" />
        </View>
      </View>
    );
  }

  const config = ESTADO_CONFIG[order.estado];
  const fecha = new Date(order.fecha);
  const fechaFormateada = fecha.toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const horaFormateada = fecha.toLocaleTimeString("es-BO", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <View className="flex-1 bg-gray-50">
      <AuthenticatedHeader title={`Pedido #${order.idVenta}`} />

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="mt-3 bg-white px-5 py-4">
          <View
            className={`flex-row items-center self-start rounded-full px-3 py-2 ${config.bg}`}
          >
            <Ionicons
              name={config.icon}
              size={16}
              color={
                order.estado === "PAGADA"
                  ? "#16a34a"
                  : order.estado === "PENDIENTE"
                  ? "#b45309"
                  : "#4b5563"
              }
            />
            <Text className={`ml-1.5 text-sm font-semibold ${config.text}`}>
              {config.label}
            </Text>
          </View>
          {order.estado === "PENDIENTE" && (
            <Text className="mt-3 text-sm text-gray-600">
              Acércate a la sucursal para completar el pago y retirar tu compra.
              Muestra este número al cajero.
            </Text>
          )}
        </View>

        <View className="mt-3 bg-white px-5 py-4">
          <Text className="text-xs uppercase tracking-wider text-gray-500">
            Comprobante
          </Text>
          <Text className="mt-1 text-sm font-mono text-gray-900" selectable>
            {order.numeroComprobante}
          </Text>
          <Text className="mt-3 text-xs uppercase tracking-wider text-gray-500">
            Fecha
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
                {order.sucursal.nombre}
              </Text>
              <Text className="text-sm text-gray-500">
                {order.sucursal.direccion} · {order.sucursal.ciudad.nombre}
              </Text>
              {order.sucursal.telefono && (
                <Text className="mt-1 text-sm text-gray-500">
                  Tel: {order.sucursal.telefono}
                </Text>
              )}
            </View>
          </View>
        </View>

        <View className="mt-3 bg-white px-5 py-4">
          <Text className="mb-3 text-xs uppercase tracking-wider text-gray-500">
            Productos ({order.detalles.length})
          </Text>
          {order.detalles.map((d) => (
            <View
              key={d.idDetalleVenta}
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
              <View className="ml-3 flex-1 justify-between">
                <View>
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
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs text-gray-500">
                    Bs {Number(d.precioUnitario).toFixed(2)} c/u
                  </Text>
                  <Text className="text-sm font-bold text-gray-900">
                    Bs {Number(d.subtotal).toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        <View className="mt-3 bg-white px-5 py-4">
          <View className="flex-row justify-between">
            <Text className="text-base text-gray-600">Modalidad</Text>
            <Text className="text-base text-gray-900">
              {order.modalidadComercial === "MINORISTA"
                ? "Minorista"
                : "Mayorista"}
            </Text>
          </View>
          <View className="mt-2 flex-row justify-between border-t border-gray-100 pt-3">
            <Text className="text-lg font-bold text-gray-900">Total</Text>
            <Text className="text-lg font-bold text-primary-500">
              Bs {Number(order.total).toFixed(2)}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
