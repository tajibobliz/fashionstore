import { useState } from "react";
import { FlatList, Image, Modal, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Promocion } from "@/types/promotion.types";

const CARD_WIDTH = 220;

function formatoFecha(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("es-BO", { day: "2-digit", month: "short" });
}

function vigencia(promocion: Promocion) {
  const inicio = formatoFecha(promocion.fechaInicio);
  const fin = formatoFecha(promocion.fechaFin);
  if (inicio && fin) return `Del ${inicio} al ${fin}`;
  if (fin) return `Hasta el ${fin}`;
  if (inicio) return `Desde el ${inicio}`;
  return "Vigente";
}

export function PromotionCard({ promocion }: { promocion: Promocion }) {
  const [open, setOpen] = useState(false);
  const productos = promocion.productos ?? [];

  return (
    <>
      <Pressable onPress={() => setOpen(true)} className="mr-4 overflow-hidden rounded-2xl" style={{ width: CARD_WIDTH }}>
        <LinearGradient
          colors={["#1f2937", "#e94560"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="p-4"
          style={{ minHeight: 150 }}
        >
          <View className="self-start rounded-full bg-white/20 px-3 py-1">
            <Text className="text-xl font-extrabold text-white">-{Number(promocion.porcentaje)}%</Text>
          </View>
          <Text className="mt-3 text-base font-bold text-white" numberOfLines={2}>
            {promocion.nombre}
          </Text>
          <Text className="mt-1 text-xs text-white/80">{vigencia(promocion)}</Text>
          {productos.length > 0 && (
            <Text className="mt-2 text-xs text-white/70" numberOfLines={1}>
              {productos.length === 1 ? "1 producto" : `${productos.length} productos`} en promo
            </Text>
          )}
        </LinearGradient>
      </Pressable>

      <PromotionProductsModal promocion={promocion} visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

function PromotionProductsModal({
  promocion,
  visible,
  onClose,
}: {
  promocion: Promocion;
  visible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const productos = promocion.productos ?? [];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="max-h-[70%] rounded-t-3xl bg-white p-5">
          <View className="mb-4 flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-lg font-bold text-gray-900" numberOfLines={2}>
                {promocion.nombre}
              </Text>
              <Text className="text-sm text-primary-500">-{Number(promocion.porcentaje)}% · {vigencia(promocion)}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} aria-label="Cerrar">
              <Ionicons name="close" size={24} color="#111827" />
            </Pressable>
          </View>

          {productos.length === 0 ? (
            <Text className="py-6 text-center text-sm text-gray-400">
              Esta promoción aplica en la tienda; todavía no tiene productos puntuales asociados.
            </Text>
          ) : (
            <FlatList
              data={productos}
              keyExtractor={(item) => String(item.idProducto)}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onClose();
                    router.push(`/product/${item.idProducto}` as any);
                  }}
                  className="mb-3 flex-row items-center rounded-xl bg-gray-50 p-2"
                >
                  {item.imagenUrl ? (
                    <Image source={{ uri: item.imagenUrl }} className="h-14 w-14 rounded-lg bg-gray-100" resizeMode="cover" />
                  ) : (
                    <View className="h-14 w-14 items-center justify-center rounded-lg bg-gray-100">
                      <Ionicons name="shirt-outline" size={22} color="#9ca3af" />
                    </View>
                  )}
                  <View className="ml-3 flex-1">
                    <Text className="text-sm font-medium text-gray-900" numberOfLines={1}>
                      {item.nombre}
                    </Text>
                    <Text className="mt-0.5 text-sm font-bold text-primary-500">Bs {Number(item.precio).toFixed(2)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
                </Pressable>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
