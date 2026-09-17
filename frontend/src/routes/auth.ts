import type { Role } from '../features/auth/types'
export function getSessionPath(role: Role) {
  if (role === 'ADMIN') return '/dashboard/admin'
  if (role === 'ENCARGADO') return '/dashboard/encargado'
  if (role === 'ENCARGADO_SUCURSAL') return '/dashboard/encargado-sucursal'
  if (role === 'CAJERO') return '/dashboard/cajero'
  if (role === 'CLIENTE') return '/tienda'
  return '/'
}
