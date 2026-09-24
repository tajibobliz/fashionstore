import { Pressable, ScrollView, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'

import { AuthenticatedHeader } from '@/components/layout/AuthenticatedHeader'
import { useAuthStore } from '@/stores/authStore'

export default function ClientDashboardScreen() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)

  const links = [
    { label: 'Explorar catálogo', icon: 'grid-outline' as const, route: '/catalog' },
    { label: 'Mi carrito', icon: 'cart-outline' as const, route: '/cart' },
    { label: 'Mis reservas', icon: 'calendar-outline' as const, route: '/reservations' },
    { label: 'Mis pedidos', icon: 'bag-handle-outline' as const, route: '/orders' },
  ]

  return (
    <View className="flex-1 bg-gray-50">
      <AuthenticatedHeader title="FashionStore" showBack={false} />
      <ScrollView contentContainerClassName="px-5 py-6">
        <Text className="text-2xl font-bold text-gray-900">Hola, {user?.nombre}</Text>
        <Text className="mt-1 text-gray-500">¿Qué quieres hacer hoy?</Text>
        <View className="mt-6 gap-3">
          {links.map((link) => (
            <Pressable key={link.route} onPress={() => router.push(link.route as any)} className="flex-row items-center rounded-2xl bg-white p-4">
              <View className="h-11 w-11 items-center justify-center rounded-full bg-primary-50"><Ionicons name={link.icon} size={22} color="#e11d48" /></View>
              <Text className="ml-3 flex-1 text-base font-semibold text-gray-900">{link.label}</Text>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}
