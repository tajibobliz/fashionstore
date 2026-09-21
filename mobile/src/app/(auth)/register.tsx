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

export default function RegisterScreen() {
  const router = useRouter();
  const register = useAuthStore((state) => state.register);

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{
    nombre?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [loading, setLoading] = useState(false);

  // Validación en el cliente antes de llamar al backend
  const validate = () => {
    const newErrors: typeof errors = {};

    if (!nombre.trim()) {
      newErrors.nombre = "El nombre es obligatorio";
    } else if (nombre.trim().length > 100) {
      newErrors.nombre = "Máximo 100 caracteres";
    }

    if (!email.trim()) {
      newErrors.email = "El correo es obligatorio";
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      newErrors.email = "Correo no válido";
    }

    if (!password) {
      newErrors.password = "La contraseña es obligatoria";
    } else if (password.length < 6) {
      newErrors.password = "Mínimo 6 caracteres";
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Confirma tu contraseña";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Las contraseñas no coinciden";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await register({
        nombre: nombre.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      // No navegamos: el _layout detecta isAuthenticated y redirige
    } catch (e) {
      const err = e as AxiosError<{ message?: string | string[] }>;
      let msg = "No se pudo crear la cuenta";
      if (!err.response) {
        msg = "Sin conexión con el servidor. Revisa tu WiFi.";
      } else if (err.response.status === 409) {
        msg = "Este correo ya está registrado";
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
        contentContainerClassName="flex-grow justify-center px-6 py-12"
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-4xl font-bold text-primary-500">FashionStore</Text>
        <Text className="mb-8 mt-2 text-base text-gray-500">
          Crea tu cuenta para comprar y guardar tus favoritos
        </Text>

        <Input
          label="Nombre"
          placeholder="Tu nombre"
          value={nombre}
          onChangeText={setNombre}
          error={errors.nombre}
          autoCapitalize="words"
        />

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
          placeholder="Mínimo 6 caracteres"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          secureTextEntry
          autoCapitalize="none"
        />

        <Input
          label="Confirmar contraseña"
          placeholder="Repite tu contraseña"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          error={errors.confirmPassword}
          secureTextEntry
          autoCapitalize="none"
        />

        <View className="mt-2">
          <Button title="Crear cuenta" onPress={handleRegister} loading={loading} />
        </View>

        <View className="mt-6 flex-row justify-center">
          <Text className="text-sm text-gray-600">¿Ya tienes cuenta? </Text>
          <Pressable onPress={() => router.replace("/login" as any)}>
            <Text className="text-sm font-semibold text-primary-500">
              Inicia sesión
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}