import { API_URL, normalizeApiUrl } from '@/config/env'
import { getSessionItem, removeSessionItem, setSessionItem } from '@/services/sessionStorage'

const API_URL_STORAGE_KEY = 'fashionstore_api_url'

/**
 * La URL elegida por la persona usuaria prevalece sobre la variable compilada.
 * Esto permite cambiar de Wi-Fi/IP local sin volver a generar el APK.
 */
export async function getRuntimeApiUrl() {
  const saved = await getSessionItem(API_URL_STORAGE_KEY)
  return saved ? normalizeApiUrl(saved) : API_URL
}

export async function setRuntimeApiUrl(value: string) {
  const apiUrl = normalizeApiUrl(value)
  await setSessionItem(API_URL_STORAGE_KEY, apiUrl)
  return apiUrl
}

export async function resetRuntimeApiUrl() {
  await removeSessionItem(API_URL_STORAGE_KEY)
}
