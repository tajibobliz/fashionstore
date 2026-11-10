import axios from 'axios'
import { api } from '../../api/axios'
import { endpoints } from '../../api/endpoints'
import { authSession } from './session'
import type { AuthResponse, AuthUser, LoginInput, RegisterInput } from './types'
import { borrarDatosLocales, invalidar, registrarEnLinea, terminarModoPin } from '../../offline/sesionOffline'

let restorePromise: Promise<void> | undefined

async function authenticate(url: string, input: LoginInput | RegisterInput) {
  const { data } = await api.post<AuthResponse>(url, input)
  authSession.set(data.access_token, data.user, data.refresh_token)
  terminarModoPin()
  void registrarEnLinea(data.user).catch(() => undefined)
  return data.user
}

export const authApi = {
  login: (input: LoginInput) => authenticate(endpoints.auth.login, input),
  register: (input: RegisterInput) => authenticate(endpoints.auth.register, input),
  async profile() {
    const { data } = await api.get<AuthUser>(endpoints.auth.profile)
    return data
  },
  async logout() {
    const refreshToken = authSession.getRefreshToken()
    const user = authSession.getSnapshot().user ?? authSession.getCachedUser()
    authSession.clear()
    await borrarDatosLocales(user).catch(() => undefined)
    if (refreshToken) await api.post(endpoints.auth.logout, { refresh_token: refreshToken })
  },
  restoreSession() {
    if (!restorePromise) {
      restorePromise = (async () => {
        const token = authSession.getToken()
        if (!token) return
        try {
          const user = await authApi.profile()
          const currentToken = authSession.getToken()
          if (currentToken && authSession.getSnapshot().status === 'loading') {
            authSession.set(currentToken, user)
          }
          // En línea y aceptado por el servidor: reinicia el plazo offline (o lo borra si cambió el rol).
          void registrarEnLinea(user).catch(() => undefined)
        } catch (error) {
          // Sin conexión no se puede validar el token: se sigue con el último usuario conocido
          // (el servidor lo validará al volver la red). Solo se cierra la sesión si el servidor la rechaza.
          const cached = authSession.getCachedUser()
          const sinRed = axios.isAxiosError(error) && !error.response
          if (sinRed && cached && authSession.getToken() === token) authSession.set(token, cached)
          else if (authSession.getToken() === token) {
            // El servidor rechazó la sesión (usuario desactivado, token inválido): fuera también el acceso offline.
            if (axios.isAxiosError(error) && error.response?.status === 401) await invalidar(cached).catch(() => undefined)
            authSession.clear()
          }
        }
      })()
    }
    return restorePromise
  },
}
