import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";

export default function OrderSuccessScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { idVenta } = useLocalSearchParams<{ idVenta: string }>();

  return (
    <View
      className="flex-1 bg-white px-6"
      style={{ paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }}
    >
      <View className="flex-1 items-center justify-center">
        {/* Ícono de éxito */}
        <View className="mb-6 h-24 w-24 items-center justify-center rounded-full bg-green-100">
          <Ionicons name="checkmark" size={64} color="#16a34a" />
        </View>

        <Text className="text-2xl font-bold text-gray-900">
          ¡Pedido confirmado!
        </Text>
        <Text className="mt-2 text-center text-gray-500">
          Tu pedido se creó correctamente. Acércate a la sucursal para completar
          el pago y retirar tu compra.
        </Text>

        {/* Número de pedido */}
        <View className="mt-8 w-full rounded-2xl bg-gray-50 px-5 py-4">
          <Text className="text-xs uppercase tracking-wider text-gray-500">
            Número de pedido
          </Text>
          <Text className="mt-1 text-3xl font-bold text-primary-500">
            #{idVenta}
          </Text>
          <Text className="mt-2 text-xs text-gray-500">
            Guarda este número, lo necesitarás en la sucursal.
          </Text>
        </View>
      </View>

      <View className="gap-3">
        <Button
          title="Volver al inicio"
          onPress={() => router.replace("/" as any)}
        />
        <Pressable
          onPress={() => router.replace("/catalog" as any)}
          className="items-center py-3"
        >
          <Text className="text-sm font-semibold text-primary-500">
            Seguir comprando
          </Text>
        </Pressable>
      </View>
    </View>
  );
}