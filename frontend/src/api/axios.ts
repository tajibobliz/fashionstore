import axios from 'axios'
import { authSession } from '../features/auth/session'
import { endpoints } from './endpoints'
import type { AuthResponse } from '../features/auth/types'
import type { InternalAxiosRequestConfig } from 'axios'

type RetryConfig = InternalAxiosRequestConfig & { authRetried?: boolean }
let refreshPromise: Promise<void> | null = null

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  timeout: 15000,
  headers: { Accept: 'application/json' },
})

api.interceptors.request.use(config => {
  const token = authSession.getToken()
  const isPublic = Object.values(endpoints.auth).filter(url => url !== endpoints.auth.profile).some(url => url === config.url)
  if (isPublic) config.headers.delete('Authorization')
  else if (token) config.headers.set('Authorization', `Bearer ${token}`)
  return config
})

api.interceptors.response.use(response => response, async error => {
  if (!axios.isAxiosError(error) || error.response?.status !== 401 || !error.config) {
    return Promise.reject(error)
  }
  const config = error.config as RetryConfig
  const token = authSession.getToken()
  const sentToken = config.headers.get('Authorization')
  if (!token || !sentToken) return Promise.reject(error)
  if (config.authRetried) {
    if (sentToken === `Bearer ${token}`) authSession.clear()
    return Promise.reject(error)
  }
  config.authRetried = true
  // Si otra solicitud ya renovó el token, basta con reintentar.
  if (sentToken === `Bearer ${token}`) {
    const refreshToken = authSession.getRefreshToken()
    if (!refreshToken) {
      authSession.clear()
      return Promise.reject(error)
    }
    if (!refreshPromise) {
      refreshPromise = api.post<AuthResponse>(endpoints.auth.refresh, { refresh_token: refreshToken })
        .then(({ data }) => {
          if (authSession.getRefreshToken() !== refreshToken) throw new Error('La sesión cambió')
          authSession.set(data.access_token, data.user, data.refresh_token)
        })
        .catch(refreshError => {
          if (authSession.getRefreshToken() === refreshToken) authSession.clear()
          throw refreshError
        })
        .finally(() => { refreshPromise = null })
    }
    await refreshPromise
  }
  const currentToken = authSession.getToken()
  if (!currentToken) return Promise.reject(error)
  config.headers.set('Authorization', `Bearer ${currentToken}`)
  return api.request(config)
})

export default api
