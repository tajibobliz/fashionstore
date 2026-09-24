import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAuthStore } from '@/stores/authStore'

interface AuthenticatedHeaderProps {
  title: string
  showBack?: boolean
}

export function AuthenticatedHeader({ title, showBack = true }: AuthenticatedHeaderProps) {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const logout = useAuthStore((state) => state.logout)

  if (!isAuthenticated) return null

  const closeSession = async () => {
    await logout()
    router.replace('/home' as any)
  }

  return (
    <View className="border-b border-gray-100 bg-white px-4" style={{ paddingTop: insets.top }}>
      <View className="h-12 flex-row items-center">
        {showBack ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={() => router.back()} className="h-10 w-10 items-center justify-center rounded-full">
            <Ionicons name="arrow-back" size={23} color="#111827" />
          </Pressable>
        ) : <View className="w-2" />}
        <Text className="ml-2 flex-1 text-lg font-bold text-gray-900" numberOfLines={1}>{title}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar sesión" onPress={() => void closeSession()} className="h-10 w-10 items-center justify-center rounded-full bg-primary-50">
          <Ionicons name="log-out-outline" size={22} color="#e11d48" />
        </Pressable>
      </View>
    </View>
  )
}
