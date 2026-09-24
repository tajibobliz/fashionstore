import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'

/**
 * SecureStore es para Android/iOS. Expo Web usa localStorage porque el módulo
 * nativo no dispone de la misma implementación en navegador.
 */
function webStorage() {
  return typeof window !== 'undefined' ? window.localStorage : null
}

export async function getSessionItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return webStorage()?.getItem(key) ?? null
  return SecureStore.getItemAsync(key)
}

export async function setSessionItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    webStorage()?.setItem(key, value)
    return
  }
  await SecureStore.setItemAsync(key, value)
}

export async function removeSessionItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    webStorage()?.removeItem(key)
    return
  }
  await SecureStore.deleteItemAsync(key)
}
