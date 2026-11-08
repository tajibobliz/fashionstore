import type { Role } from '../features/auth/types'
/** Tienda por defecto: sus clientas usan las rutas antiguas sin /t/ (/tienda, /login). */
export const DEFAULT_SLUG = 'fashionstore'

/**
 * Página de inicio según el rol. Una clienta va al catálogo de SU tienda: si es de otra empresa
 * (Urban Step), a /t/<slug>/tienda; mandarla a /tienda mostraba la tienda por defecto con datos ajenos.
 */
export function getSessionPath(role: Role, empresaSlug?: string | null) {
  if (role === 'ADMIN') return '/dashboard/admin'
  if (role === 'ENCARGADO') return '/dashboard/encargado'
  if (role === 'ENCARGADO_SUCURSAL') return '/dashboard/encargado-sucursal'
  if (role === 'CAJERO') return '/dashboard/cajero'
  if (role === 'CLIENTE') return empresaSlug && empresaSlug !== DEFAULT_SLUG ? `/t/${empresaSlug}/tienda` : '/tienda'
  if (role === 'SUPER_ADMIN') return '/plataforma'
  return '/'
}
