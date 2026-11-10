/**
 * Caché corta (30 s) de "¿este usuario sigue activo?", consultada en cada petición autenticada.
 * Así, al desactivar a alguien su token deja de servir en segundos (sin esperar a que venza) y
 * no se consulta la base en cada request. Al cambiar el estado se borra su entrada.
 */
const TTL_MS = 30_000;
const cache = new Map<number, { activo: boolean; hasta: number }>();

export function estadoEnCache(idUsuario: number): boolean | undefined {
  const e = cache.get(idUsuario);
  if (!e) return undefined;
  if (e.hasta < Date.now()) {
    cache.delete(idUsuario);
    return undefined;
  }
  return e.activo;
}

export function guardarEstado(idUsuario: number, activo: boolean) {
  if (cache.size > 10_000) cache.clear();
  cache.set(idUsuario, { activo, hasta: Date.now() + TTL_MS });
}

export function olvidarEstado(idUsuario: number) {
  cache.delete(idUsuario);
}
