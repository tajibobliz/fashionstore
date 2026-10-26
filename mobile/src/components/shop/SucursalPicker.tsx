import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useSucursalStore } from "@/stores/sucursalStore";
import { useAuthStore } from "@/stores/authStore";
import { branchesService } from "@/services/branches.service";
import { sucursalesGuardadas } from "@/offline/catalog";
import { useOnline } from "@/offline/network";

/**
 * Selector de sucursal (chips). Con conexión lista las sucursales de la tienda; sin conexión,
 * las que tienen catálogo guardado en el teléfono. Si no hay ninguna elegida, toma la primera.
 */
export function SucursalPicker({ titulo = "Sucursal" }: { titulo?: string }) {
  const online = useOnline();
  const user = useAuthStore((s) => s.user);
  const { idSucursal, elegir } = useSucursalStore();
  const [opciones, setOpciones] = useState<{ idSucursal: number; nombre: string }[]>([]);

  useEffect(() => {
    let vigente = true;
    const cargar = async () => {
      try {
        const lista = online
          ? await branchesService.getAll()
          : user?.idEmpresa ? await sucursalesGuardadas(user.idEmpresa) : [];
        if (!vigente) return;
        setOpciones(lista);
        const actual = lista.find((s) => s.idSucursal === idSucursal);
        if (!actual && lista[0]) void elegir(lista[0].idSucursal, lista[0].nombre);
      } catch {
        if (vigente) setOpciones([]);
      }
    };
    void cargar();
    return () => { vigente = false; };
  }, [online, user?.idEmpresa, idSucursal, elegir]);

  if (!opciones.length) return null;
  return (
    <View className="mt-6">
      <Text className="mb-3 text-base font-semibold text-gray-900">{titulo}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        {opciones.map((s) => {
          const activa = s.idSucursal === idSucursal;
          return (
            <Pressable
              key={s.idSucursal}
              onPress={() => void elegir(s.idSucursal, s.nombre)}
              accessibilityRole="button"
              accessibilityState={{ selected: activa }}
              className={`h-11 justify-center rounded-full border px-4 ${activa ? "border-primary-500 bg-primary-500" : "border-gray-300 bg-white"}`}
            >
              <Text className={`text-sm font-semibold ${activa ? "text-white" : "text-gray-900"}`}>{s.nombre}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
