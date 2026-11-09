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
import { generateUUID } from "@/lib/uuid";
import { useSucursalStore } from "@/stores/sucursalStore";
import { SucursalPicker } from "@/components/shop/SucursalPicker";
import { useFormatMoney } from "@/lib/moneda";

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const fmt = useFormatMoney();
  const router = useRouter();

  const user = useAuthStore((state) => state.user);
  const items = useCartStore((state) => state.items);
  const subtotal = useCartStore((state) => state.getSubtotal());
  const clearCart = useCartStore((state) => state.clearCart);

  const [processing, setProcessing] = useState(false);

  const handleConfirmar = async () => {
    if (items.length === 0) {
      Alert.alert("Carrito vacío", "Agrega productos antes de comprar.");
      return;
    }

    const idSucursal = useSucursalStore.getState().idSucursal;
    if (!idSucursal) {
      Alert.alert("Elige una sucursal", "Selecciona la sucursal donde recogerás tu compra.");
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
          idSucursal
        );
      }

      // 3) Crear la venta desde el carrito (queda PENDIENTE)
      const venta = await salesService.createFromCart({
        idSucursal,
        modalidadComercial: "MINORISTA",
        clientRequestId,
      });

      // 4) Éxito: vaciar carrito local y elegir cómo pagar (medios que activó la tienda: tarjeta,
      //    QR, transferencia, efectivo…), igual que en la web.
      clearCart();
      router.replace(`/pagar/${venta.idVenta}` as any);
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
                {fmt(item.precio * item.cantidad)}
              </Text>
            </View>
          ))}
        </View>

        {/* Sucursal donde se recoge la compra */}
        <View className="mt-3 bg-white px-5 pb-4">
          <SucursalPicker titulo="Sucursal de retiro" />
        </View>

        <View className="mx-5 mt-3">
          <Text className="text-xs text-gray-500">
            Al confirmar, tu pedido queda registrado y eliges cómo pagarlo: tarjeta, QR, transferencia o
            efectivo al retirar, según los medios que ofrece la tienda.
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
            {fmt(subtotal)}
          </Text>
        </View>
        <Button
          title={processing ? "Procesando..." : "Confirmar y pagar"}
          onPress={handleConfirmar}
          loading={processing}
        />
      </View>
    </View>
  );
}
