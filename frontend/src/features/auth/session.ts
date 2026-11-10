import type { AuthUser } from './types'

const storageKey = 'fashionstore.access_token'
const refreshKey = 'fashionstore.refresh_token'
/** Último usuario conocido: permite seguir trabajando si la página se recarga sin conexión. */
const userKey = 'fashionstore.user'
const listeners = new Set<() => void>()
let token = sessionStorage.getItem(storageKey)
let snapshot: { user: AuthUser | null; status: 'loading' | 'authenticated' | 'anonymous' } = {
  user: null,
  status: token ? 'loading' : 'anonymous',
}

export const authSession = {
  getToken: () => token,
  getRefreshToken: () => sessionStorage.getItem(refreshKey),
  getCachedUser(): AuthUser | null {
    try { return JSON.parse(sessionStorage.getItem(userKey) ?? 'null') as AuthUser | null } catch { return null }
  },
  getSnapshot: () => snapshot,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },
  set(accessToken: string, user: AuthUser, refreshToken?: string) {
    if (refreshToken) sessionStorage.setItem(refreshKey, refreshToken)
    sessionStorage.setItem(storageKey, accessToken)
    sessionStorage.setItem(userKey, JSON.stringify(user))
    token = accessToken
    snapshot = { user, status: 'authenticated' }
    listeners.forEach(listener => listener())
  },
  clear() {
    sessionStorage.removeItem(storageKey)
    sessionStorage.removeItem(refreshKey)
    sessionStorage.removeItem(userKey)
    token = null
    snapshot = { user: null, status: 'anonymous' }
    listeners.forEach(listener => listener())
  },
}
