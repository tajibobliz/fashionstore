import { View, Text, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/stores/authStore";

export default function HomeScreen() {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const router = useRouter();

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="px-6 pt-16 pb-8">
        <Text className="text-4xl font-bold text-primary-500">FashionStore</Text>

        {isAuthenticated ? (
          <Text className="mt-2 text-base text-gray-500">
            Hola, {user?.nombre} 👋
          </Text>
        ) : (
          <Text className="mt-2 text-base text-gray-500">
            Descubre las últimas tendencias
          </Text>
        )}
      </View>

      <View className="px-6">
        <Text className="mb-4 text-lg font-semibold text-gray-900">
          Explora nuestro catálogo
        </Text>
        <Button
          title="Ver catálogo"
          onPress={() => router.push("/catalog" as any)}
        />

        {!isAuthenticated && (
          <View className="mt-8">
            <Text className="mb-4 text-lg font-semibold text-gray-900">
              ¿Ya tienes cuenta?
            </Text>
            <Button
              title="Iniciar sesión"
              onPress={() => router.push("/login" as any)}
              variant="outline"
            />
          </View>
        )}
      </View>
    </ScrollView>
  );
}