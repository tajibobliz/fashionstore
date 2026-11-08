import { useSyncExternalStore } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { offlineDb } from './db'
import type { SesionOfflineLocal } from './db'
import type { AuthUser, Role } from '../features/auth/types'

/**
 * Sesión offline con PIN (CU17 / RF-028).
 *
 * - **Activar** (con internet): el usuario elige un PIN de 6 dígitos. Con PBKDF2 (derivación lenta,
 *   310 000 iteraciones) el PIN se convierte en una clave AES-GCM que cifra los tokens de sesión.
 *   El PIN no se guarda: si se puede descifrar, el PIN es correcto (AES-GCM detecta la clave errónea).
 * - **Entrar sin conexión**: se pide el PIN; al 5.º intento fallido se borra la sesión guardada.
 * - **Plazo**: se cuenta desde la última vez en línea (`validadaEn`); vencido, solo se puede consultar.
 * - **Cerrar sesión** borra la sesión offline y los datos de la empresa (menos lo que falta enviar).
 */

export const ROLES_CON_PIN: Role[] = ['CLIENTE', 'CAJERO', 'ENCARGADO_SUCURSAL']
export const MAX_INTENTOS = 5
export const LARGO_PIN = 6
const ITERACIONES = 310_000
const HORAS_POR_DEFECTO = 72

export interface Tokens { access: string; refresh?: string | null }
export const claveSesion = (u: Pick<AuthUser, 'idEmpresa' | 'idUsuario'>) => `${u.idEmpresa}:${u.idUsuario}`
const horasDe = (u: AuthUser) => u.empresa?.horasSesionOffline ?? HORAS_POR_DEFECTO

/** Vence a las `validadaEn + horas`. */
export const venceEn = (s: Pick<SesionOfflineLocal, 'validadaEn' | 'horas'>) => new Date(Date.parse(s.validadaEn) + s.horas * 3_600_000)

async function derivarClave(pin: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERACIONES, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export const pinValido = (pin: string) => new RegExp(`^\\d{${LARGO_PIN}}$`).test(pin) && !/^(\d)\1+$/.test(pin) && !'0123456789'.includes(pin) && !'9876543210'.includes(pin)

/** Activa (o reemplaza) el acceso sin conexión de este usuario en este navegador. */
export async function activarPin(pin: string, user: AuthUser, tokens: Tokens) {
  if (!user.idEmpresa) throw new Error('Solo usuarios de una tienda')
  if (!pinValido(pin)) throw new Error(`El PIN debe tener ${LARGO_PIN} dígitos y no ser una secuencia ni números repetidos`)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const clave = await derivarClave(pin, salt)
  const cifrado = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, clave, new TextEncoder().encode(JSON.stringify(tokens)))
  const ahora = new Date().toISOString()
  await offlineDb.sesiones.put({
    clave: claveSesion(user), idEmpresa: user.idEmpresa, idUsuario: user.idUsuario, user,
    salt, iv, cifrado, horas: horasDe(user), validadaEn: ahora, intentosFallidos: 0, creadaEn: ahora,
  })
}

export type ResultadoPin =
  | { ok: true; user: AuthUser; tokens: Tokens; vence: Date }
  | { ok: false; restantes: number; bloqueada: boolean }

/** Intenta abrir la sesión guardada con el PIN. Cuenta los intentos fallidos y borra al llegar al máximo. */
export async function desbloquear(clave: string, pin: string): Promise<ResultadoPin> {
  const s = await offlineDb.sesiones.get(clave)
  if (!s) return { ok: false, restantes: 0, bloqueada: true }
  try {
    const plano = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: s.iv as BufferSource }, await derivarClave(pin, s.salt), s.cifrado)
    const tokens = JSON.parse(new TextDecoder().decode(plano)) as Tokens
    await offlineDb.sesiones.update(clave, { intentosFallidos: 0 })
    marcarModoPin(clave)
    return { ok: true, user: s.user, tokens, vence: venceEn(s) }
  } catch {
    const intentos = s.intentosFallidos + 1
    if (intentos >= MAX_INTENTOS) {
      await offlineDb.sesiones.delete(clave)
      return { ok: false, restantes: 0, bloqueada: true }
    }
    await offlineDb.sesiones.update(clave, { intentosFallidos: intentos })
    return { ok: false, restantes: MAX_INTENTOS - intentos, bloqueada: false }
  }
}

/**
 * El usuario está en línea con una sesión válida (login o perfil confirmado por el servidor):
 * reinicia el plazo y toma el plazo y el rol vigentes. Si el rol cambió, la sesión offline se borra
 * (el token cifrado lleva el rol anterior): tendrá que activar el PIN otra vez.
 */
export async function registrarEnLinea(user: AuthUser) {
  if (!user.idEmpresa) return
  const s = await offlineDb.sesiones.get(claveSesion(user))
  if (!s) return
  if (s.user.rol !== user.rol) return offlineDb.sesiones.delete(s.clave)
  await offlineDb.sesiones.update(s.clave, { validadaEn: new Date().toISOString(), horas: horasDe(user), user: { ...s.user, ...user } })
}

/** El servidor rechazó al usuario (p. ej. fue desactivado): su sesión offline deja de valer. */
export async function invalidar(user: Pick<AuthUser, 'idEmpresa' | 'idUsuario'> | null | undefined) {
  if (user?.idEmpresa) await offlineDb.sesiones.delete(claveSesion(user))
}

/**
 * Al cerrar sesión se borran de este navegador la sesión offline, el carrito offline y los datos
 * de la empresa (catálogos y operaciones ya resueltas). Las operaciones que aún no se enviaron NO se borran:
 * son ventas o pedidos reales; se envían la próxima vez que ese usuario inicie sesión.
 */
export async function borrarDatosLocales(user: AuthUser | null | undefined) {
  if (!user?.idEmpresa) return
  await offlineDb.transaction('rw', [offlineDb.sesiones, offlineDb.catalogos, offlineDb.operaciones, offlineDb.carritos], async () => {
    await offlineDb.sesiones.delete(claveSesion(user))
    await offlineDb.carritos.where('[idEmpresa+idUsuario]').equals([user.idEmpresa!, user.idUsuario]).delete()
    const otras = await offlineDb.sesiones.where('idEmpresa').equals(user.idEmpresa!).count()
    if (!otras) await offlineDb.catalogos.where('idEmpresa').equals(user.idEmpresa!).delete()
    const propias = await offlineDb.operaciones.where('[idEmpresa+idUsuario]').equals([user.idEmpresa!, user.idUsuario]).toArray()
    await offlineDb.operaciones.bulkDelete(propias.filter(o => o.estado !== 'PENDIENTE' && o.estado !== 'ENVIANDO').map(o => o.operationId))
  })
  terminarModoPin()
}

// ------------------------------------------------------------------ estado de la sesión actual

/** Si la sesión de esta pestaña se abrió con PIN (sin conexión), guarda su clave. */
const MODO_KEY = 'fashionstore.sesion_pin'
const listeners = new Set<() => void>()
let modo: string | null = (() => { try { return sessionStorage.getItem(MODO_KEY) } catch { return null } })()
function marcarModoPin(clave: string) {
  modo = clave
  try { sessionStorage.setItem(MODO_KEY, clave) } catch { /* sin almacenamiento */ }
  listeners.forEach(l => l())
}
export function terminarModoPin() {
  modo = null
  try { sessionStorage.removeItem(MODO_KEY) } catch { /* sin almacenamiento */ }
  listeners.forEach(l => l())
}

/** Sesiones guardadas en este navegador (para la pantalla "Acceso sin conexión"). */
export function useSesionesGuardadas(idEmpresa?: number | null) {
  return useLiveQuery(
    () => (idEmpresa ? offlineDb.sesiones.where('idEmpresa').equals(idEmpresa).toArray() : offlineDb.sesiones.toArray()),
    [idEmpresa],
  )
}

/** Reloj que avanza cada minuto (para saber si venció el plazo sin leer la hora durante el render). */
let ahora = Date.now()
const relojListeners = new Set<() => void>()
let reloj: number | undefined
function suscribirReloj(l: () => void) {
  relojListeners.add(l)
  if (reloj === undefined) reloj = window.setInterval(() => { ahora = Date.now(); relojListeners.forEach(f => f()) }, 60_000)
  return () => {
    relojListeners.delete(l)
    if (!relojListeners.size) { window.clearInterval(reloj); reloj = undefined }
  }
}

export interface ModoOffline {
  /** Este usuario tiene acceso sin conexión activo en el navegador. */
  activo: boolean
  /** La sesión de esta pestaña se abrió con el PIN. */
  conPin: boolean
  ultimaConexion: Date | null
  vence: Date | null
  /** Pasó el plazo: sin conexión solo puede consultar. */
  vencido: boolean
  /** Hora de referencia (avanza cada minuto). */
  ahora: number
}

/** Plazo y estado offline del usuario actual. */
export function useModoOffline(user: AuthUser | null | undefined): ModoOffline {
  const conPin = useSyncExternalStore(l => { listeners.add(l); return () => { listeners.delete(l) } }, () => modo)
  const t = useSyncExternalStore(suscribirReloj, () => ahora)
  const s = useLiveQuery(() => (user?.idEmpresa ? offlineDb.sesiones.get(claveSesion(user)) : undefined), [user?.idEmpresa, user?.idUsuario])
  if (!s) return { activo: false, conPin: !!conPin, ultimaConexion: null, vence: null, vencido: false, ahora: t }
  const vence = venceEn(s)
  return { activo: true, conPin: conPin === s.clave, ultimaConexion: new Date(s.validadaEn), vence, vencido: vence.getTime() <= t, ahora: t }
}

/** Para guardar operaciones: sin conexión y con el plazo vencido no se permite (solo consulta). */
export async function puedeOperarSinConexion(user: Pick<AuthUser, 'idEmpresa' | 'idUsuario'>) {
  if (navigator.onLine || !user.idEmpresa) return true
  const s = await offlineDb.sesiones.get(claveSesion(user))
  return !s || venceEn(s).getTime() > Date.now()
}
