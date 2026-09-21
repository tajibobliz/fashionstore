import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Sale, EstadoVenta } from "@/types/checkout.types";

interface Props {
  sale: Sale;
}

type EstadoConfig = {
  label: string;
  bg: string;
  text: string;
};

const ESTADO_CONFIG: Record<EstadoVenta, EstadoConfig> = {
  PENDIENTE: {
    label: "Pendiente de pago",
    bg: "bg-amber-100",
    text: "text-amber-800",
  },
  PAGADA: {
    label: "Pagada",
    bg: "bg-green-100",
    text: "text-green-800",
  },
  CANCELADA: {
    label: "Cancelada",
    bg: "bg-gray-200",
    text: "text-gray-600",
  },
  DEVUELTA_PARCIAL: {
    label: "Devuelta parcial",
    bg: "bg-orange-100",
    text: "text-orange-800",
  },
  DEVUELTA: {
    label: "Devuelta",
    bg: "bg-red-100",
    text: "text-red-800",
  },
};

export function OrderCard({ sale }: Props) {
  const router = useRouter();
  const config = ESTADO_CONFIG[sale.estado];

  const fecha = new Date(sale.fecha);
  const fechaFormateada = fecha.toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const totalItems = sale.detalles.reduce((sum, d) => sum + d.cantidad, 0);

  return (
    <Pressable
      onPress={() => router.push(`/orders/${sale.idVenta}` as any)}
      className="mx-4 mb-3 rounded-2xl bg-white p-4"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
      }}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-bold text-gray-900">
          Pedido #{sale.idVenta}
        </Text>
        <View className={`rounded-full px-3 py-1 ${config.bg}`}>
          <Text className={`text-xs font-semibold ${config.text}`}>
            {config.label}
          </Text>
        </View>
      </View>

      <Text className="mt-1 text-xs text-gray-500">{fechaFormateada}</Text>

      <View className="mt-3 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Ionicons name="bag-outline" size={16} color="#6b7280" />
          <Text className="ml-1 text-sm text-gray-600">
            {totalItems} {totalItems === 1 ? "producto" : "productos"}
          </Text>
        </View>
        <Text className="text-lg font-bold text-primary-500">
          Bs {Number(sale.total).toFixed(2)}
        </Text>
      </View>

      <View className="mt-2 flex-row items-center">
        <Ionicons name="location-outline" size={14} color="#9ca3af" />
        <Text className="ml-1 text-xs text-gray-500">
          {sale.sucursal.nombre} · {sale.sucursal.ciudad.nombre}
        </Text>
      </View>

      <View className="mt-3 flex-row items-center justify-end">
        <Text className="mr-1 text-sm font-semibold text-primary-500">
          Ver detalles
        </Text>
        <Ionicons name="chevron-forward" size={16} color="#e11d48" />
      </View>
    </Pressable>
  );
}