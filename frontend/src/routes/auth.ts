import type { Role } from '../features/auth/types'

export function getSessionPath(role: Role) {
  if (role === 'ADMIN' || role === 'ENCARGADO') return '/panel'
  if (role === 'CAJERO') return '/pos'
  return '/tienda'
}
