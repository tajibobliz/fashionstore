import { useEffect, useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { API_URL } from '@/config/env'
import { getRuntimeApiUrl, resetRuntimeApiUrl, setRuntimeApiUrl } from '@/services/apiUrl.service'

export default function ServerSettingsScreen() {
  const [url, setUrl] = useState(API_URL)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void getRuntimeApiUrl().then(setUrl).catch(() => undefined)
  }, [])

  const save = async () => {
    try {
      setSaving(true)
      const saved = await setRuntimeApiUrl(url)
      Alert.alert('Servidor configurado', `La aplicación usará ${saved}.`, [{ text: 'Volver al inicio de sesión', onPress: () => router.back() }])
    } catch (error) {
      Alert.alert('URL no válida', error instanceof Error ? error.message : 'Ingresa una URL válida.')
    } finally {
      setSaving(false)
    }
  }

  const reset = async () => {
    await resetRuntimeApiUrl()
    setUrl(API_URL)
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerClassName="flex-grow justify-center px-6" keyboardShouldPersistTaps="handled">
        <Text className="text-3xl font-bold text-primary-500">Servidor</Text>
        <Text className="mb-8 mt-2 text-base leading-6 text-gray-600">
          Para el backend local usa la IP Wi-Fi de tu computadora, por ejemplo http://192.168.1.20:3000. Para una APK distribuida usa la URL HTTPS de Render o Railway.
        </Text>
        <Input label="URL del backend" value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://api.ejemplo.com" />
        <Button title="Guardar servidor" onPress={() => void save()} loading={saving} />
        <View className="mt-3"><Button title="Usar URL configurada al compilar" variant="outline" onPress={() => void reset()} /></View>
        <View className="mt-6"><Button title="Volver" variant="outline" onPress={() => router.back()} /></View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
