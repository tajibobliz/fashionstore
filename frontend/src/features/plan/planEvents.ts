/**
 * Restricciones del plan que devuelve el backend (403 con `code`).
 * El interceptor de axios las publica como evento y el aviso del dashboard las muestra,
 * así cualquier pantalla (sucursales, personal, etc.) informa el motivo sin código extra.
 */
export type CodigoRestriccion = 'LIMITE_DEL_PLAN' | 'PLAN_SIN_FUNCIONALIDAD' | 'SUSCRIPCION_VENCIDA' | 'EMPRESA_SUSPENDIDA'
export interface RestriccionPlan { code: CodigoRestriccion; message: string }

const EVENTO = 'fashionstore:restriccion-plan'
const CODIGOS = new Set<string>(['LIMITE_DEL_PLAN', 'PLAN_SIN_FUNCIONALIDAD', 'SUSCRIPCION_VENCIDA', 'EMPRESA_SUSPENDIDA'])

export function publicarRestriccion(body: unknown) {
  if (!body || typeof body !== 'object') return
  const { code, message } = body as { code?: unknown; message?: unknown }
  if (typeof code === 'string' && CODIGOS.has(code) && typeof message === 'string') {
    window.dispatchEvent(new CustomEvent<RestriccionPlan>(EVENTO, { detail: { code: code as CodigoRestriccion, message } }))
  }
}

export function escucharRestricciones(listener: (r: RestriccionPlan) => void) {
  const handler = (event: Event) => listener((event as CustomEvent<RestriccionPlan>).detail)
  window.addEventListener(EVENTO, handler)
  return () => window.removeEventListener(EVENTO, handler)
}
