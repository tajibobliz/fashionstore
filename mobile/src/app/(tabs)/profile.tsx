import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { AuthenticatedHeader } from "@/components/layout/AuthenticatedHeader";
import { useAuthStore } from "@/stores/authStore";

interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

function MenuItem({ icon, label, onPress, disabled }: MenuItemProps) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      className={`flex-row items-center border-b border-gray-100 bg-white px-5 py-4 ${
        disabled ? "opacity-40" : ""
      }`}
    >
      <View className="h-9 w-9 items-center justify-center rounded-full bg-primary-50">
        <Ionicons name={icon} size={20} color="#e11d48" />
      </View>
      <Text className="ml-3 flex-1 text-base text-gray-900">{label}</Text>
      {!disabled && (
        <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
      )}
      {disabled && (
        <Text className="text-xs text-gray-400">Próximamente</Text>
      )}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert(
      "Cerrar sesión",
      "¿Estás seguro que quieres cerrar sesión?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Cerrar sesión",
          style: "destructive",
          onPress: async () => {
            await logout();
            router.replace("/home" as any);
          },
        },
      ]
    );
  };

  // Sin sesión
  if (!isAuthenticated) {
    return (
      <View
        className="flex-1 items-center justify-center bg-white px-6"
        style={{ paddingTop: insets.top }}
      >
        <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-gray-100">
          <Ionicons name="person-outline" size={40} color="#9ca3af" />
        </View>
        <Text className="text-2xl font-bold text-gray-900">Mi Perfil</Text>
        <Text className="mt-2 text-center text-gray-500">
          Inicia sesión para ver tus pedidos, reservas y más.
        </Text>
        <View className="mt-6 w-full">
          <Button
            title="Iniciar sesión"
            onPress={() => router.push("/login" as any)}
          />
        </View>
        <Pressable
          onPress={() => router.push("/register" as any)}
          className="mt-3 items-center py-2"
        >
          <Text className="text-sm text-gray-600">
            ¿No tienes cuenta?{" "}
            <Text className="font-semibold text-primary-500">Crea una</Text>
          </Text>
        </Pressable>
      </View>
    );
  }

  // Con sesión
  return (
    <View className="flex-1 bg-gray-50">
      <AuthenticatedHeader title="Perfil" />
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        {/* Header con datos del usuario */}
        <View
          className="bg-white px-5 pb-5"
          style={{ paddingTop: 20 }}
        >
          <View className="flex-row items-center">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-primary-500">
              <Text className="text-2xl font-bold text-white">
                {user?.nombre?.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="ml-4 flex-1">
              <Text className="text-xl font-bold text-gray-900">
                {user?.nombre} {user?.apellido ?? ""}
              </Text>
              <Text className="mt-0.5 text-sm text-gray-500">
                {user?.email}
              </Text>
            </View>
          </View>
        </View>

        {/* Menú de opciones */}
        <View className="mt-3">
          <MenuItem
            icon="server-outline"
            label="Configurar servidor"
            onPress={() => router.push("/server" as any)}
          />
          <MenuItem
            icon="bag-handle-outline"
            label="Mis pedidos"
            onPress={() => router.push("/orders" as any)}
          />
         <MenuItem
  icon="calendar-outline"
  label="Mis reservas"
  onPress={() => router.push("/reservations" as any)}
/>
          <MenuItem
            icon="heart-outline"
            label="Favoritos"
            onPress={() => {}}
            disabled
          />
          <MenuItem
            icon="location-outline"
            label="Direcciones"
            onPress={() => {}}
            disabled
          />
        </View>

        {/* Cerrar sesión */}
        <View className="mt-6 px-5">
          <Button
            title="Cerrar sesión"
            onPress={handleLogout}
            variant="outline"
          />
        </View>
      </ScrollView>
    </View>
  );
}
