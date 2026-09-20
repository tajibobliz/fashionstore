import { View, Text } from "react-native";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/stores/authStore";

export default function HomeScreen() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Text className="text-3xl font-bold text-primary-500">FashionStore</Text>
      <Text className="mt-4 text-lg text-gray-800">
        Hola, {user?.nombre} 👋
      </Text>
      <Text className="mb-8 mt-1 text-sm text-gray-500">
        {user?.email} · {user?.rol}
      </Text>

      <View className="w-full">
        <Button title="Cerrar sesión" onPress={logout} variant="outline" />
      </View>
    </View>
  );
}