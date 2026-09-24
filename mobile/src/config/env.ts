import { Platform } from 'react-native'
import { mobileLog } from '@/utils/mobileLogger'

function normalizeUrl(value: string) {
  return value.trim().replace(/\/+$/, '')
}

/*
 * Expo publica las variables EXPO_PUBLIC_* en el bundle.
 * Producción usa Render/Railway; desarrollo móvil usa la IP LAN actual.
 * Expo Web usa el host actual si no se definió una URL explícita.
 */
const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL
const webApiUrl = Platform.OS === 'web' && typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:3000`
  : undefined

export const API_URL = normalizeUrl(configuredApiUrl || webApiUrl || 'http://localhost:3000')
export const API_TIMEOUT = 15000

export function normalizeApiUrl(value: string) {
  const normalized = normalizeUrl(value)
  const parsed = new URL(normalized)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('La URL debe comenzar con http:// o https://')
  }
  return normalized
}

mobileLog('API configurada', {
  apiUrl: API_URL,
  platform: Platform.OS,
  source: configuredApiUrl ? 'EXPO_PUBLIC_API_URL' : webApiUrl ? 'host de Expo Web' : 'fallback local',
})

const configuredBranch = Number(process.env.EXPO_PUBLIC_DEFAULT_SUCURSAL_ID ?? '1')
export const DEFAULT_SUCURSAL_ID = Number.isInteger(configuredBranch) && configuredBranch > 0
  ? configuredBranch
  : 1
