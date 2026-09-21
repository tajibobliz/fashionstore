import { View, Text } from "react-native";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/stores/authStore";
import { useRouter } from "expo-router";

export default function ProfileScreen() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const router = useRouter();

  if (!isAuthenticated) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="mb-2 text-2xl font-bold text-gray-900">Mi Perfil</Text>
        <Text className="mb-8 text-center text-gray-500">
          Inicia sesión para ver tu perfil y pedidos
        </Text>
        <View className="w-full">
          <Button
            title="Iniciar sesión"
            onPress={() => router.push("/login" as any)}
          />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Text className="text-2xl font-bold text-gray-900">
        {user?.nombre} {user?.apellido}
      </Text>
      <Text className="mt-1 mb-8 text-gray-500">{user?.email}</Text>
      <View className="w-full">
        <Button title="Cerrar sesión" onPress={logout} variant="outline" />
      </View>
    </View>
  );
}