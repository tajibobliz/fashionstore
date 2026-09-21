import { useState } from "react";
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { AxiosError } from "axios";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuthStore } from "@/stores/authStore";

export default function LoginScreen() {
  const login = useAuthStore((state) => state.login);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);

  // Validación en el cliente antes de llamar al backend
  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email.trim()) newErrors.email = "El correo es obligatorio";
    else if (!/^\S+@\S+\.\S+$/.test(email)) newErrors.email = "Correo no válido";
    if (!password) newErrors.password = "La contraseña es obligatoria";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      // No navegamos aquí: _layout.tsx detecta isAuthenticated y redirige
    } catch (e) {
      const err = e as AxiosError<{ message?: string | string[] }>;
      let msg = "No se pudo iniciar sesión";
      if (!err.response) {
        msg = "Sin conexión con el servidor. Revisa la WiFi y que el backend esté corriendo.";
      } else if (err.response.status === 401) {
        msg = "Correo o contraseña incorrectos";
      } else if (err.response.data?.message) {
        const m = err.response.data.message;
        msg = Array.isArray(m) ? m.join("\n") : m;
      }
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerClassName="flex-grow justify-center px-6"
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-4xl font-bold text-primary-500">FashionStore</Text>
        <Text className="mb-8 mt-2 text-base text-gray-500">
          Inicia sesión para continuar
        </Text>

        <Input
          label="Correo electrónico"
          placeholder="tucorreo@ejemplo.com"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Input
          label="Contraseña"
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          secureTextEntry
          autoCapitalize="none"
        />

        <View className="mt-2">
          <Button title="Iniciar sesión" onPress={handleLogin} loading={loading} />
        </View>
        <View className="mt-6 flex-row justify-center">
        <Text className="text-sm text-gray-600">¿No tienes cuenta? </Text>
        <Pressable onPress={() => router.replace("/register" as any)}>
        <Text className="text-sm font-semibold text-primary-500">
        Crea una
        </Text>
        </Pressable>
       </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}