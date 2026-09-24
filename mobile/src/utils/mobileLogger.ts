type LogData = Record<string, unknown>

/** Diagnóstico solo para desarrollo: nunca registrar contraseñas ni tokens. */
export function mobileLog(event: string, data: LogData = {}) {
  if (__DEV__) console.info(`[FashionStore Mobile] ${event}`, data)
}

export function mobileWarn(event: string, data: LogData = {}) {
  if (__DEV__) console.warn(`[FashionStore Mobile] ${event}`, data)
}
