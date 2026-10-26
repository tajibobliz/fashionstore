import axios from 'axios'
import { api } from '../../api/axios'
import { endpoints } from '../../api/endpoints'
import { authSession } from './session'
import type { AuthResponse, AuthUser, LoginInput, RegisterInput } from './types'

let restorePromise: Promise<void> | undefined

async function authenticate(url: string, input: LoginInput | RegisterInput) {
  const { data } = await api.post<AuthResponse>(url, input)
  authSession.set(data.access_token, data.user, data.refresh_token)
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
    authSession.clear()
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
        } catch (error) {
          // Sin conexión no se puede validar el token: se sigue con el último usuario conocido
          // (el servidor lo validará al volver la red). Solo se cierra la sesión si el servidor la rechaza.
          const cached = authSession.getCachedUser()
          const sinRed = axios.isAxiosError(error) && !error.response
          if (sinRed && cached && authSession.getToken() === token) authSession.set(token, cached)
          else if (authSession.getToken() === token) authSession.clear()
        }
      })()
    }
    return restorePromise
  },
}
