import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/stores/authStore";
import { useOnline } from "@/offline/network";
import { catalogoGuardado, descontarStockLocal, prepararOffline, sucursalesGuardadas } from "@/offline/catalog";
import type { PrendaLocal, SucursalLocal } from "@/offline/catalog";
import { encolar, alCambiarLaCola } from "@/offline/queue";
import { sincronizarPronto } from "@/offline/sync";

const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es-BO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Catálogo guardado en SQLite: funciona sin internet. La clienta elige sucursal y deja
 * reservas en la cola; se envían solas al volver la conexión.
 */
export default function OfflineCatalogScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const online = useOnline();
  const user = useAuthStore((s) => s.user);
  const [sucursales, setSucursales] = useState<SucursalLocal[] | null>(null);
  const [idSucursal, setIdSucursal] = useState<number | null>(null);
  const [prendas, setPrendas] = useState<PrendaLocal[]>([]);
  const [actualizando, setActualizando] = useState(false);

  const [version, setVersion] = useState(0);
  const sucursal = sucursales?.find((s) => s.idSucursal === idSucursal) ?? sucursales?.[0];

  // Sucursales guardadas (se vuelven a leer cuando cambia la cola o se actualiza el catálogo).
  useEffect(() => {
    if (!user?.idEmpresa) return;
    let vigente = true;
    sucursalesGuardadas(user.idEmpresa).then((lista) => { if (vigente) setSucursales(lista); }).catch(() => { if (vigente) setSucursales([]); });
    return () => { vigente = false; };
  }, [user?.idEmpresa, version]);

  // Prendas y stock de la sucursal elegida.
  useEffect(() => {
    if (!user?.idEmpresa || !sucursal) return;
    let vigente = true;
    catalogoGuardado(user.idEmpresa, sucursal.idSucursal).then((p) => { if (vigente) setPrendas(p); }).catch(() => {});
    return () => { vigente = false; };
  }, [user?.idEmpresa, sucursal, version]);

  useEffect(() => alCambiarLaCola(() => setVersion((v) => v + 1)), []);

  const actualizar = async () => {
    if (!user?.idEmpresa) return;
    setActualizando(true);
    await prepararOffline(user.idEmpresa);
    setVersion((v) => v + 1);
    setActualizando(false);
  };

  const reservar = async (p: PrendaLocal, v: PrendaLocal["variantes"][number]) => {
    if (!user?.idEmpresa || !sucursal) return;
    const detalle = [v.talla ?? "Única", v.color].filter(Boolean).join(" / ");
    const items = [{ idVariante: v.idVariante, cantidad: 1 }];
    await encolar({
      tipo: "RESERVA", idEmpresa: user.idEmpresa, idUsuario: user.idUsuario, idSucursal: sucursal.idSucursal,
      payload: { detalles: items },
      resumen: `Reserva · ${p.nombre} (${detalle}) · ${sucursal.nombre}`,
    });
    await descontarStockLocal(user.idEmpresa, sucursal.idSucursal, items);
    sincronizarPronto(1000);
    Alert.alert(
      "Reserva guardada",
      online
        ? "Se está enviando a la tienda. Mira el resultado en Operaciones pendientes."
        : `Se enviará a ${sucursal.nombre} cuando vuelva la conexión.`,
      [
        { text: "Ver pendientes", onPress: () => router.push("/offline/pendientes" as any) },
        { text: "Seguir viendo", style: "cancel" },
      ],
    );
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white px-5 pb-4" style={{ paddingTop: insets.top + 12 }}>
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()} className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-gray-100" accessibilityLabel="Volver">
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-xl font-bold text-gray-900">Catálogo sin conexión</Text>
            {sucursal && <Text className="text-xs text-gray-500">Guardado {fecha(sucursal.guardadoEn)}</Text>}
          </View>
          {online && (
            <Pressable onPress={actualizar} disabled={actualizando} className="h-10 w-10 items-center justify-center rounded-full bg-primary-50" accessibilityLabel="Actualizar catálogo">
              {actualizando ? <ActivityIndicator color="#e11d48" /> : <Ionicons name="refresh" size={20} color="#e11d48" />}
            </Pressable>
          )}
        </View>
        <View className={`mt-3 flex-row items-start rounded-xl px-3 py-2.5 ${online ? "bg-green-50" : "bg-gray-100"}`}>
          <Ionicons name={online ? "cloud-done-outline" : "cloud-offline-outline"} size={18} color={online ? "#15803d" : "#4b5563"} />
          <Text className={`ml-2 flex-1 text-xs leading-5 ${online ? "text-green-800" : "text-gray-700"}`}>
            {online
              ? "Con conexión. Este catálogo queda guardado para cuando no tengas internet."
              : "Sin conexión. Puedes reservar: la reserva se envía sola cuando vuelva internet. El stock es el de la última descarga."}
          </Text>
        </View>
      </View>

      {sucursales === null ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color="#e11d48" /></View>
      ) : !sucursales.length ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="cloud-download-outline" size={48} color="#9ca3af" />
          <Text className="mt-3 text-center text-gray-600">
            Todavía no hay un catálogo guardado. Abre la app con internet y con tu sesión iniciada para descargarlo.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pb-3">
            {sucursales.map((s) => {
              const activa = s.idSucursal === sucursal?.idSucursal;
              return (
                <Pressable
                  key={s.idSucursal}
                  onPress={() => setIdSucursal(s.idSucursal)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: activa }}
                  className={`h-10 justify-center rounded-full border px-4 ${activa ? "border-primary-500 bg-primary-500" : "border-gray-300 bg-white"}`}
                >
                  <Text className={`text-sm font-semibold ${activa ? "text-white" : "text-gray-900"}`}>{s.nombre}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {prendas.map((p) => (
            <View key={p.idProducto} className="mb-3 rounded-2xl border border-gray-100 bg-white p-4">
              {p.categoria && <Text className="text-xs uppercase tracking-wider text-gray-500">{p.categoria}</Text>}
              <Text className="mt-0.5 text-base font-bold text-gray-900">{p.nombre}</Text>
              <Text className="mt-1 font-bold text-primary-500">Bs {p.precioFinal.toFixed(2)}</Text>
              {p.variantes.map((v) => (
                <View key={v.idVariante} className="mt-2 flex-row items-center border-t border-gray-100 pt-2">
                  <Text className="flex-1 text-sm text-gray-700">
                    {[v.talla ?? "Única", v.color].filter(Boolean).join(" / ")} · {v.stock ? `${v.stock} disp.` : "sin stock"}
                  </Text>
                  <Pressable
                    disabled={!v.stock}
                    onPress={() => void reservar(p, v)}
                    className={`h-9 justify-center rounded-lg border px-3 ${v.stock ? "border-primary-500" : "border-gray-200"}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Reservar ${p.nombre} ${v.talla ?? ""} ${v.color ?? ""}`}
                  >
                    <Text className={`text-sm font-semibold ${v.stock ? "text-primary-500" : "text-gray-400"}`}>Reservar</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
