import axios from 'axios'

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message: unknown = error.response?.data?.message
    if (typeof message === 'string') return message
    if (Array.isArray(message) && message.every(item => typeof item === 'string')) {
      return message.join('. ')
    }
    if (!error.response) return 'No se pudo conectar con el servidor. Intenta nuevamente.'
  }
  return 'No se pudo completar la solicitud.'
}
