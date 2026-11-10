import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/stores/authStore";
import { useOnline } from "@/offline/network";
import { useOperaciones, descartar, limpiarConfirmadas } from "@/offline/queue";
import type { EstadoLocal, OperacionLocal } from "@/offline/queue";
import { sincronizar, useEstadoSync } from "@/offline/sync";

const ETIQUETA: Record<EstadoLocal, string> = {
  PENDIENTE: "Pendiente", ENVIANDO: "Enviando", CONFIRMADA: "Confirmada", CONFLICTO: "Conflicto", RECHAZADA: "Rechazada",
};
const COLOR: Record<EstadoLocal, string> = {
  PENDIENTE: "bg-blue-50 text-blue-700", ENVIANDO: "bg-blue-50 text-blue-700", CONFIRMADA: "bg-green-50 text-green-700",
  CONFLICTO: "bg-amber-50 text-amber-700", RECHAZADA: "bg-red-50 text-red-700",
};
const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es-BO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/** Operaciones guardadas en este teléfono y el resultado que devolvió el servidor. */
export default function PendientesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const online = useOnline();
  const user = useAuthStore((s) => s.user);
  const sync = useEstadoSync();
  const ops = useOperaciones(user?.idEmpresa, user?.idUsuario);
  const porEnviar = ops.filter((o) => o.estado === "PENDIENTE" || o.estado === "ENVIANDO").length;

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white px-5 pb-4" style={{ paddingTop: insets.top + 12 }}>
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()} className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-gray-100" accessibilityLabel="Volver">
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-xl font-bold text-gray-900">Operaciones pendientes</Text>
            <Text className="text-xs text-gray-500">
              {online ? "Con conexión" : "Sin conexión"}
              {sync.ultimaSync ? ` · última sincronización ${fecha(sync.ultimaSync)}` : ""}
            </Text>
          </View>
        </View>
        <Text className={`mt-3 rounded-xl px-3 py-2.5 text-xs leading-5 ${sync.error ? "bg-amber-50 text-amber-800" : "bg-gray-100 text-gray-700"}`}>
          {sync.error
            ? `${sync.error} Se reintentará automáticamente.`
            : "Lo que haces sin internet se guarda aquí y se envía solo. Reenviar es seguro: la tienda no lo duplica."}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 140 }}>
        {ops.length ? ops.map((op) => <Item key={op.operationId} op={op} />) : (
          <View className="items-center py-16">
            <Ionicons name="checkmark-done-outline" size={44} color="#9ca3af" />
            <Text className="mt-3 text-gray-500">No hay operaciones guardadas.</Text>
          </View>
        )}
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 border-t border-gray-100 bg-white px-5 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
        <Button
          title={sync.sincronizando ? "Enviando…" : porEnviar ? `Sincronizar ahora (${porEnviar})` : "Nada por enviar"}
          onPress={() => void sincronizar()}
          disabled={!online || !porEnviar}
          loading={sync.sincronizando}
        />
        {ops.some((o) => o.estado === "CONFIRMADA") && user?.idEmpresa && (
          <View className="mt-2">
            <Button title="Limpiar confirmadas" variant="outline" onPress={() => void limpiarConfirmadas(user.idEmpresa!, user.idUsuario)} />
          </View>
        )}
      </View>
    </View>
  );
}

function Item({ op }: { op: OperacionLocal }) {
  const final = op.estado === "CONFIRMADA" || op.estado === "CONFLICTO" || op.estado === "RECHAZADA";
  const [fondo, texto] = COLOR[op.estado].split(" ");
  const alternativas = [...new Set(op.alternativas.map((a) => `${a.sucursal} (${a.stock})`))];
  return (
    <View className="mb-3 rounded-2xl border border-gray-100 bg-white p-4">
      <View className="flex-row items-start">
        <Text className="flex-1 pr-2 text-sm font-semibold text-gray-900">{op.resumen}</Text>
        <View className={`rounded-full px-2.5 py-1 ${fondo}`}>
          <Text className={`text-xs font-bold uppercase ${texto}`}>{ETIQUETA[op.estado]}</Text>
        </View>
      </View>
      <Text className="mt-1 text-xs text-gray-500">
        Creada {fecha(op.createdAtLocal)} · código {op.operationId.slice(0, 8)}
        {op.serverId ? ` · ${op.tipo === "VENTA" ? "venta" : "reserva"} #${op.serverId}` : ""}
        {op.intentos > 1 ? ` · ${op.intentos} envíos` : ""}
      </Text>
      {op.motivo && <Text className="mt-2 text-sm leading-5 text-gray-700">{op.motivo}</Text>}
      {alternativas.length > 0 && <Text className="mt-1 text-sm leading-5 text-gray-700">Disponible en: {alternativas.join(", ")}</Text>}
      {op.estado === "PENDIENTE" && op.ultimoError && <Text className="mt-1 text-xs text-gray-500">{op.ultimoError}</Text>}
      {final && (
        <Pressable onPress={() => void descartar(op.operationId)} className="mt-2 self-start py-1">
          <Text className="text-sm font-semibold text-primary-500">Quitar de la lista</Text>
        </Pressable>
      )}
    </View>
  );
}
