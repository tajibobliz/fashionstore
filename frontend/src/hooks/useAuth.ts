import { useSyncExternalStore } from 'react'
import { authSession } from '../features/auth/session'
import { authApi } from '../features/auth/auth.api'

export function useAuth() {
  const session = useSyncExternalStore(authSession.subscribe, authSession.getSnapshot)
  return {
    ...session,
    isAuthenticated: session.status === 'authenticated',
    login: authApi.login,
    register: authApi.register,
    logout: authApi.logout,
  }
}
