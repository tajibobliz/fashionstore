import axios from 'axios'

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message: unknown = error.response?.data?.message
    if (typeof message === 'string') return message
    if (Array.isArray(message) && message.every(item => typeof item === 'string')) {
      return message.join('. ')
    }
    if (!error.response) return 'No se pudo conectar con el servidor. Intenta nuevamente.'
    const status = error.response.status
    if (status === 400) return 'La solicitud contiene datos no válidos.'
    if (status === 401) return 'Tu sesión no es válida. Inicia sesión nuevamente.'
    if (status === 403) return 'No tienes permiso para realizar esta acción.'
    if (status === 404) return 'No se encontró el recurso solicitado.'
    if (status === 409) return 'No se pudo completar la operación porque existe un conflicto.'
    if (status >= 500) return 'El servidor no pudo completar la solicitud. Intenta más tarde.'
  }
  return 'No se pudo completar la solicitud.'
}
