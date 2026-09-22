import { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";

import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { catalogService } from "@/services/catalog.service";
import { Producto, VarianteProducto } from "@/types/catalog.types";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCartStore } from "@/stores/cartStore";
import { useAuthStore } from "@/stores/authStore";
import { reservationsService } from "@/services/reservations.service";
import { DEFAULT_SUCURSAL_ID } from "@/config/env";

const PLACEHOLDER_IMAGE =
  "https://placehold.co/600x800/f3f4f6/9ca3af?text=Sin+imagen";

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const addItem = useCartStore((state) => state.addItem);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [reservando, setReservando] = useState(false);
  const [producto, setProducto] = useState<Producto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Variante que el usuario ha seleccionado (talla + color)
  const [varianteSeleccionada, setVarianteSeleccionada] =
    useState<VarianteProducto | null>(null);

  useEffect(() => {
    const fetchProducto = async () => {
      try {
        const data = await catalogService.getProductoById(Number(id));
        setProducto(data);
        // Si solo hay una variante, la seleccionamos automáticamente
        if (data.variantes && data.variantes.length === 1) {
          setVarianteSeleccionada(data.variantes[0]);
        }
      } catch (e) {
        const err = e as AxiosError;
        if (!err.response) {
          setError("Sin conexión con el servidor.");
        } else if (err.response.status === 404) {
          setError("Producto no encontrado.");
        } else {
          setError("No se pudo cargar el producto.");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchProducto();
  }, [id]);

    const handleAgregarCarrito = () => {
    if (!varianteSeleccionada || !producto) {
      Alert.alert("Selecciona una opción", "Debes elegir talla y color.");
      return;
    }

    addItem({
      idVariante: varianteSeleccionada.idVariante,
      nombre: producto.nombre,
      precio: Number(producto.precio),
      talla: varianteSeleccionada.talla?.nombre ?? null,
      color: varianteSeleccionada.color?.nombre ?? null,
      colorHex: varianteSeleccionada.color?.codigoHex ?? null,
      imagenUrl: producto.imagenUrl,
      cantidad: 1,
    });

    Alert.alert("Agregado al carrito", `${producto.nombre} se agregó a tu carrito.`, [
      { text: "Seguir viendo", style: "cancel" },
      { text: "Ver carrito", onPress: () => router.push("/cart" as any) },
    ]);
  };

  const handleReservar = async () => {
    if (!varianteSeleccionada || !producto) {
      Alert.alert("Selecciona una opción", "Debes elegir talla y color.");
      return;
    }

    if (!isAuthenticated) {
      Alert.alert(
        "Necesitas iniciar sesión",
        "Para reservar y probarte el producto, necesitas tener una cuenta.",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Iniciar sesión", onPress: () => router.push("/login" as any) },
        ]
      );
      return;
    }

    Alert.alert(
      "Confirmar reserva",
      `¿Reservar 1 unidad de ${producto.nombre} (Talla ${varianteSeleccionada.talla?.nombre}, ${varianteSeleccionada.color?.nombre}) para probártela en sucursal?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Reservar",
          onPress: async () => {
            setReservando(true);
            try {
              const reserva = await reservationsService.create({
                idSucursal: DEFAULT_SUCURSAL_ID,
                detalles: [
                  { idVariante: varianteSeleccionada.idVariante, cantidad: 1 },
                ],
              });
              Alert.alert(
                "Reserva creada",
                `Tu reserva #${reserva.idReserva} está lista. Acércate a la sucursal para probártela.`,
                [
                  { text: "Ver mis reservas", onPress: () => router.push("/reservations" as any) },
                  { text: "Ok", style: "cancel" },
                ]
              );
            } catch (e: any) {
              const msg =
                e?.response?.data?.message ??
                "No se pudo crear la reserva. Verifica que haya stock disponible.";
              Alert.alert(
                "Error",
                Array.isArray(msg) ? msg.join("\n") : String(msg)
              );
            } finally {
              setReservando(false);
            }
          },
        },
      ]
    );
  };

  // 1) Cargando
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#e11d48" />
      </View>
    );
  }

  // 2) Error
  if (error || !producto) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="mb-2 text-lg font-semibold text-gray-900">
          {error ?? "Producto no encontrado"}
        </Text>
        <View className="mt-4 w-full">
          <Button title="Volver" onPress={() => router.back()} variant="outline" />
        </View>
      </View>
    );
  }

  // Datos derivados del producto
  const precioFormateado = Number(producto.precio).toFixed(2);
  const tallas = getUnique(producto.variantes ?? [], (v) => v.talla);
  const colores = getUnique(producto.variantes ?? [], (v) => v.color);

  return (
    <View className="flex-1 bg-white">
      <ScrollView contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}>
        {/* Imagen principal */}
        <View className="relative">
          {producto.imagenUrl ? (
          <Image
           source={{ uri: producto.imagenUrl }}
           className="h-96 w-full bg-gray-100"
           resizeMode="cover"
           />
          ) : (
         <View className="h-96 w-full items-center justify-center bg-gray-100">
         <Ionicons name="image-outline" size={80} color="#9ca3af" />
         <Text className="mt-2 text-sm text-gray-400">Sin imagen</Text>
         </View>
        )}
          {/* Botón atrás flotante */}
          <Pressable
            onPress={() => router.back()}
            className="absolute left-4 top-14 h-10 w-10 items-center justify-center rounded-full bg-white/90"
          >
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </Pressable>
        </View>

        {/* Info principal */}
        <View className="px-6 pt-5">
          {producto.categoria && (
            <Text className="text-xs uppercase tracking-wider text-gray-500">
              {producto.categoria.nombre}
            </Text>
          )}
          <Text className="mt-1 text-2xl font-bold text-gray-900">
            {producto.nombre}
          </Text>
          <Text className="mt-2 text-2xl font-bold text-primary-500">
            Bs {precioFormateado}
          </Text>

          {/* Descripción */}
          <Text className="mt-5 text-sm leading-6 text-gray-700">
            {producto.descripcion}
          </Text>

          {/* Selector de talla */}
          {tallas.length > 0 && (
            <View className="mt-6">
              <Text className="mb-3 text-base font-semibold text-gray-900">
                Talla
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {tallas.map((talla) => {
                  const isSelected =
                    varianteSeleccionada?.talla?.idTalla === talla.idTalla;
                  return (
                    <Pressable
                      key={talla.idTalla}
                      onPress={() => {
                        // Buscar una variante con esa talla (respetando color si ya hay uno)
                        const nueva = producto.variantes?.find(
                          (v) =>
                            v.talla?.idTalla === talla.idTalla &&
                            (!varianteSeleccionada?.color ||
                              v.color?.idColor === varianteSeleccionada.color.idColor)
                        );
                        if (nueva) setVarianteSeleccionada(nueva);
                      }}
                      className={`h-12 min-w-[48px] items-center justify-center rounded-lg border px-4 ${
                        isSelected
                          ? "border-primary-500 bg-primary-500"
                          : "border-gray-300 bg-white"
                      }`}
                    >
                      <Text
                        className={`text-sm font-semibold ${
                          isSelected ? "text-white" : "text-gray-900"
                        }`}
                      >
                        {talla.nombre}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Selector de color */}
          {colores.length > 0 && (
            <View className="mt-6">
              <Text className="mb-3 text-base font-semibold text-gray-900">
                Color{" "}
                {varianteSeleccionada?.color && (
                  <Text className="font-normal text-gray-500">
                    · {varianteSeleccionada.color.nombre}
                  </Text>
                )}
              </Text>
              <View className="flex-row flex-wrap gap-3">
                {colores.map((color) => {
                  const isSelected =
                    varianteSeleccionada?.color?.idColor === color.idColor;
                  return (
                    <Pressable
                      key={color.idColor}
                      onPress={() => {
                        const nueva = producto.variantes?.find(
                          (v) =>
                            v.color?.idColor === color.idColor &&
                            (!varianteSeleccionada?.talla ||
                              v.talla?.idTalla === varianteSeleccionada.talla.idTalla)
                        );
                        if (nueva) setVarianteSeleccionada(nueva);
                      }}
                      className={`h-11 w-11 items-center justify-center rounded-full border-2 ${
                        isSelected ? "border-primary-500" : "border-gray-200"
                      }`}
                    >
                      <View
                        className="h-8 w-8 rounded-full"
                        style={{ backgroundColor: color.codigoHex }}
                      />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          
         {/* Botón probador virtual (solo si hay recursoRaUrl) */}
           {producto.recursoRaUrl && (
           <View className="mt-6  mb-8" >
           <Button
            title="👗 Probar en vestidor virtual"
            onPress={() => router.push(`/virtual-fitting/${producto.idProducto}` as any)}
            variant="outline"
            />
          </View>
         )}
        </View>
      </ScrollView>

      {/* Botón fijo abajo */}
      <View
  className="absolute bottom-0 left-0 right-0 border-t border-gray-100 bg-white px-6 pt-4"
  style={{ paddingBottom: insets.bottom + 16 }}
>
  <Button
    title="Agregar al carrito"
    onPress={handleAgregarCarrito}
  />
  <View className="mt-2">
    <Button
      title={reservando ? "Reservando..." : "Reservar para probar"}
      onPress={handleReservar}
      loading={reservando}
      variant="outline"
    />
  </View>
</View>
    </View>
  );
}

// Helper: extrae valores únicos de una lista (por ej. tallas únicas entre variantes)
function getUnique<T, K extends { idTalla?: number; idColor?: number }>(
  items: T[],
  getKey: (item: T) => K | null
): K[] {
  const map = new Map<number, K>();
  for (const item of items) {
    const key = getKey(item);
    if (!key) continue;
    const id = key.idTalla ?? key.idColor ?? 0;
    if (!map.has(id)) map.set(id, key);
  }
  return Array.from(map.values());
}