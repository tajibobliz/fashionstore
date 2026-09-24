import { ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'

import { Button } from '@/components/ui/Button'

export default function PublicHomeScreen() {
  const router = useRouter()

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="flex-grow justify-center px-6 py-12">
      <Text className="text-4xl font-bold text-primary-500">FashionStore</Text>
      <Text className="mt-3 text-base leading-6 text-gray-600">Moda femenina para cada momento. Explora las prendas disponibles en nuestras sucursales.</Text>
      <View className="mt-10"><Button title="Ver catálogo" onPress={() => router.push('/catalog' as any)} /></View>
      <View className="mt-4"><Button title="Iniciar sesión" variant="outline" onPress={() => router.push('/login' as any)} /></View>
    </ScrollView>
  )
}
