import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { AxiosError } from "axios";

import { Button } from "@/components/ui/Button";
import { AuthenticatedHeader } from "@/components/layout/AuthenticatedHeader";
import { cartService } from "@/services/cart.service";
import { paymentsService } from "@/services/payments.service";
import { salesService } from "@/services/sales.service";
import { useAuthStore } from "@/stores/authStore";
import { useCartStore } from "@/stores/cartStore";
import { useShopStore } from "@/stores/shopStore";
import { generateUUID } from "@/lib/uuid";
import type { MetodoPago } from "@/types/checkout.types";

const PAYMENT_METHODS: { id: MetodoPago; label: string; icon: keyof typeof Ionicons.glyphMap; enabled: boolean }[] = [
  { id: "EFECTIVO", label: "Efectivo (en sucursal)", icon: "cash-outline", enabled: true },
  { id: "QR", label: "QR (próximamente)", icon: "qr-code-outline", enabled: false },
  { id: "TARJETA", label: "Tarjeta (próximamente)", icon: "card-outline", enabled: false },
];

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const cart = useCartStore((state) => state.cart);
  const setCart = useCartStore((state) => state.setCart);
  const subtotal = useCartStore((state) => state.getSubtotal());
  const details = cart?.detalles ?? [];
  const selectedBranchId = useShopStore((state) => state.selectedBranchId);
  const branchId = cart?.sucursal?.idSucursal ?? selectedBranchId;
  const [selectedMethod, setSelectedMethod] = useState<MetodoPago>("EFECTIVO");
  const [processing, setProcessing] = useState(false);

  const handleConfirm = async () => {
    if (!branchId || details.length === 0) {
      Alert.alert("Carrito vacío", "Agrega productos antes de comprar.");
      return;
    }
    setProcessing(true);
    try {
      const venta = await salesService.createFromCart({ idSucursal: branchId, modalidadComercial: "MINORISTA", clientRequestId: generateUUID() });
      await paymentsService.create({ idVenta: venta.idVenta, metodo: selectedMethod, monto: Number(venta.total) });
      setCart(await cartService.getMyCart(branchId));
      router.replace(`/order-success?idVenta=${venta.idVenta}` as any);
    } catch (error) {
      const apiError = error as AxiosError<{ message?: string | string[] }>;
      const detail = apiError.response?.data?.message;
      Alert.alert("Error al comprar", !apiError.response ? "Sin conexión con el servidor." : Array.isArray(detail) ? detail.join("\n") : detail ?? "No se pudo procesar tu pedido.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      <AuthenticatedHeader title="Finalizar compra" />
      <ScrollView contentContainerStyle={{ paddingBottom: 200 }}>
        <View className="mt-3 bg-white px-5 py-4"><Text className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">Datos del cliente</Text><Text className="text-base font-semibold text-gray-900">{user?.nombre} {user?.apellido ?? ""}</Text><Text className="mt-1 text-sm text-gray-500">{user?.email}</Text></View>
        <View className="mt-3 bg-white px-5 py-4"><Text className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">Resumen del pedido ({details.length} {details.length === 1 ? "producto" : "productos"})</Text>{details.map((item) => <View key={item.idDetalleCarrito} className="mb-2 flex-row justify-between"><View className="flex-1 pr-2"><Text className="text-sm text-gray-900" numberOfLines={1}>{item.variante.producto.nombre}</Text><Text className="text-xs text-gray-500">{item.variante.talla ? `Talla ${item.variante.talla.nombre}` : ""}{item.variante.talla && item.variante.color ? " · " : ""}{item.variante.color?.nombre ?? ""} × {item.cantidad}</Text></View><Text className="text-sm font-semibold text-gray-900">Bs {(Number(item.precio) * item.cantidad).toFixed(2)}</Text></View>)}</View>
        <View className="mt-3 bg-white px-5 py-4"><Text className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">Método de pago</Text>{PAYMENT_METHODS.map((method) => { const selected = selectedMethod === method.id; return <Pressable key={method.id} disabled={!method.enabled} onPress={() => setSelectedMethod(method.id)} className={`mb-2 flex-row items-center rounded-xl border p-3 ${selected ? "border-primary-500 bg-primary-50" : "border-gray-200 bg-white"} ${!method.enabled ? "opacity-40" : ""}`}><Ionicons name={method.icon} size={22} color={selected ? "#e11d48" : "#6b7280"} /><Text className={`ml-3 flex-1 text-sm ${selected ? "font-semibold text-gray-900" : "text-gray-700"}`}>{method.label}</Text>{selected ? <Ionicons name="checkmark-circle" size={22} color="#e11d48" /> : null}</Pressable>; })}</View>
      </ScrollView>
      <View className="absolute bottom-0 left-0 right-0 border-t border-gray-100 bg-white px-6 pt-4" style={{ paddingBottom: insets.bottom + 16 }}><View className="mb-3 flex-row justify-between"><Text className="text-lg font-bold text-gray-900">Total a pagar</Text><Text className="text-lg font-bold text-primary-500">Bs {subtotal.toFixed(2)}</Text></View><Button title={processing ? "Procesando..." : "Confirmar pedido"} onPress={() => void handleConfirm()} loading={processing} disabled={!branchId || details.length === 0} /></View>
    </View>
  );
}
