import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/stores/authStore";
import { useCartStore } from "@/stores/cartStore";
import { cartService } from "@/services/cart.service";
import { salesService } from "@/services/sales.service";
import { paymentsService } from "@/services/payments.service";
import { generateUUID } from "@/lib/uuid";
import { DEFAULT_SUCURSAL_ID } from "@/config/env";
import { MetodoPago } from "@/types/checkout.types";

// Métodos de pago disponibles.
// Por ahora solo EFECTIVO está activo; los otros quedan visibles pero deshabilitados.
const PAYMENT_METHODS: {
  id: MetodoPago;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  enabled: boolean;
}[] = [
  { id: "EFECTIVO", label: "Efectivo (en sucursal)", icon: "cash-outline", enabled: true },
  { id: "QR", label: "QR (próximamente)", icon: "qr-code-outline", enabled: false },
  { id: "TARJETA", label: "Tarjeta (próximamente)", icon: "card-outline", enabled: false },
];

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const user = useAuthStore((state) => state.user);
  const items = useCartStore((state) => state.items);
  const subtotal = useCartStore((state) => state.getSubtotal());
  const clearCart = useCartStore((state) => state.clearCart);

  const [selectedMethod, setSelectedMethod] = useState<MetodoPago>("EFECTIVO");
  const [processing, setProcessing] = useState(false);

  const handleConfirmar = async () => {
    if (items.length === 0) {
      Alert.alert("Carrito vacío", "Agrega productos antes de comprar.");
      return;
    }

    // Generamos un UUID para idempotencia (si la petición se reintenta, no se duplica la venta)
    const clientRequestId = generateUUID();

    setProcessing(true);
    try {
      // 1) Vaciar carrito remoto por si tenía algo viejo
      await cartService.clearCart().catch(() => {
        // Si falla porque no existía, ignoramos
      });

      // 2) Sincronizar cada item local con el backend
      for (const item of items) {
        await cartService.addItem(
          item.idVariante,
          item.cantidad,
          DEFAULT_SUCURSAL_ID
        );
      }

      // 3) Crear la venta desde el carrito (queda PENDIENTE)
      const venta = await salesService.createFromCart({
        idSucursal: DEFAULT_SUCURSAL_ID,
        modalidadComercial: "MINORISTA",
        clientRequestId,
      });

      // 4) Registrar el pago EFECTIVO (queda PENDIENTE de aprobación en caja)
      await paymentsService.create({
        idVenta: venta.idVenta,
        metodo: selectedMethod,
        monto: Number(venta.total),
      });

      // 5) Éxito: vaciar carrito local y navegar a la pantalla de confirmación
      clearCart();
      router.replace(`/order-success?idVenta=${venta.idVenta}` as any);
    } catch (e) {
      const err = e as AxiosError<{ message?: string | string[] }>;
      let msg = "No se pudo procesar tu pedido.";
      if (!err.response) {
        msg = "Sin conexión con el servidor.";
      } else if (err.response.data?.message) {
        const m = err.response.data.message;
        msg = Array.isArray(m) ? m.join("\n") : m;
      }
      Alert.alert("Error al comprar", msg);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center bg-white px-4 pb-3 pt-2">
        <Pressable onPress={() => router.back()} className="mr-3">
          <Ionicons name="arrow-back" size={26} color="#111827" />
        </Pressable>
        <Text className="text-xl font-bold text-gray-900">Finalizar compra</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 200 }}>
        {/* Datos del cliente */}
        <View className="mt-3 bg-white px-5 py-4">
          <Text className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Datos del cliente
          </Text>
          <Text className="text-base font-semibold text-gray-900">
            {user?.nombre} {user?.apellido ?? ""}
          </Text>
          <Text className="mt-1 text-sm text-gray-500">{user?.email}</Text>
        </View>

        {/* Resumen del pedido */}
        <View className="mt-3 bg-white px-5 py-4">
          <Text className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Resumen del pedido ({items.length}{" "}
            {items.length === 1 ? "producto" : "productos"})
          </Text>
          {items.map((item) => (
            <View
              key={item.idVariante}
              className="mb-2 flex-row justify-between"
            >
              <View className="flex-1 pr-2">
                <Text className="text-sm text-gray-900" numberOfLines={1}>
                  {item.nombre}
                </Text>
                <Text className="text-xs text-gray-500">
                  {item.talla && `Talla ${item.talla}`}
                  {item.talla && item.color ? " · " : ""}
                  {item.color} × {item.cantidad}
                </Text>
              </View>
              <Text className="text-sm font-semibold text-gray-900">
                Bs {(item.precio * item.cantidad).toFixed(2)}
              </Text>
            </View>
          ))}
        </View>

        {/* Método de pago */}
        <View className="mt-3 bg-white px-5 py-4">
          <Text className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Método de pago
          </Text>
          {PAYMENT_METHODS.map((m) => {
            const isSelected = selectedMethod === m.id;
            return (
              <Pressable
                key={m.id}
                onPress={() => m.enabled && setSelectedMethod(m.id)}
                disabled={!m.enabled}
                className={`mb-2 flex-row items-center rounded-xl border p-3 ${
                  isSelected
                    ? "border-primary-500 bg-primary-50"
                    : "border-gray-200 bg-white"
                } ${!m.enabled ? "opacity-40" : ""}`}
              >
                <Ionicons
                  name={m.icon}
                  size={22}
                  color={isSelected ? "#e11d48" : "#6b7280"}
                />
                <Text
                  className={`ml-3 flex-1 text-sm ${
                    isSelected ? "font-semibold text-gray-900" : "text-gray-700"
                  }`}
                >
                  {m.label}
                </Text>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={22} color="#e11d48" />
                )}
              </Pressable>
            );
          })}
          <Text className="mt-2 text-xs text-gray-500">
            Al confirmar, tu pedido queda registrado. Acércate a la sucursal
            para completar el pago y retirar tu compra.
          </Text>
        </View>
      </ScrollView>

      {/* Botón fijo abajo */}
      <View
        className="absolute bottom-0 left-0 right-0 border-t border-gray-100 bg-white px-6 pt-4"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <View className="mb-3 flex-row justify-between">
          <Text className="text-lg font-bold text-gray-900">Total a pagar</Text>
          <Text className="text-lg font-bold text-primary-500">
            Bs {subtotal.toFixed(2)}
          </Text>
        </View>
        <Button
          title={processing ? "Procesando..." : "Confirmar pedido"}
          onPress={handleConfirmar}
          loading={processing}
        />
      </View>
    </View>
  );
}