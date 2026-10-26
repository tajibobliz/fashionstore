import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@/stores/authStore";
import { useOnline } from "@/offline/network";
import { useOperaciones } from "@/offline/queue";
import { useEstadoSync } from "@/offline/sync";

/**
 * Aviso flotante sobre la barra de pestañas: aparece sin conexión o cuando hay operaciones
 * por enviar o con aviso. Sin conexión lleva al catálogo guardado; si no, a la cola.
 */
export function OfflineChip() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const online = useOnline();
  const user = useAuthStore((s) => s.user);
  const sync = useEstadoSync();
  const ops = useOperaciones(user?.idEmpresa, user?.idUsuario);

  if (!user?.idEmpresa) return null;
  const porEnviar = ops.filter((o) => o.estado === "PENDIENTE" || o.estado === "ENVIANDO").length;
  const avisos = ops.filter((o) => o.estado === "CONFLICTO" || o.estado === "RECHAZADA").length;
  if (online && !porEnviar && !avisos) return null;

  const texto = !online ? "Sin conexión · ver catálogo guardado" : sync.sincronizando ? "Sincronizando…" : porEnviar ? `${porEnviar} por enviar` : `${avisos} para revisar`;
  const punto = !online ? "bg-gray-400" : sync.sincronizando ? "bg-blue-500" : "bg-amber-500";

  return (
    <View pointerEvents="box-none" className="absolute left-0 right-0 items-center" style={{ bottom: insets.bottom + 76 }}>
      <Pressable
        onPress={() => router.push((online ? "/offline/pendientes" : "/offline") as any)}
        accessibilityRole="button"
        className="flex-row items-center rounded-full border border-gray-200 bg-white px-4 py-2.5 shadow"
      >
        <View className={`mr-2 h-2.5 w-2.5 rounded-full ${punto}`} />
        <Text className="text-sm font-semibold text-gray-900">{texto}</Text>
        {!online && porEnviar > 0 && (
          <View className="ml-2 rounded-full bg-primary-50 px-2 py-0.5">
            <Text className="text-xs font-bold text-primary-600">{porEnviar}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}
