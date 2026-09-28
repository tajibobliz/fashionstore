import { Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Button } from "@/components/ui/Button";

// #e94560 es el mismo rosa que primary-500 en tailwind.config.js (el que usa <Button/>); #b32444 es
// primary-700 de esa misma escala. Se usan como hex directo porque LinearGradient no acepta className.
export function HomeBanner() {
  const router = useRouter();

  return (
    <View className="mx-6 mb-8 overflow-hidden rounded-3xl">
      <LinearGradient
        colors={["#e94560", "#b32444"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="p-6"
      >
        <Text className="text-sm font-semibold uppercase tracking-wide text-white/80">
          Nueva temporada
        </Text>
        <Text className="mt-1 text-2xl font-bold text-white">
          Explora nuestra colección
        </Text>
        {/* Ancho fijo (no self-start): <Button/> no trae padding horizontal propio y, sin un ancho
            explícito, un Pressable dentro de un View column se estira al 100% del contenedor. */}
        <View className="mt-5 w-44">
          <Button title="Ver catálogo" onPress={() => router.push("/catalog" as any)} />
        </View>
      </LinearGradient>
    </View>
  );
}
