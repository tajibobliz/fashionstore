import axios from 'axios'
import { useSyncExternalStore } from 'react'
import { syncApi } from '../api/sync.api'
import { queryClient } from '../api/queryClient'
import { authSession } from '../features/auth/session'
import { deviceId, offlineDb } from './db'
import type { OperacionLocal } from './db'

/**
 * Motor de sincronización: envía al servidor las operaciones PENDIENTES del usuario actual.
 *
 * - Se dispara al volver la conexión, al iniciar sesión, después de encolar y cada minuto.
 * - Si el envío falla, reintenta con "backoff exponencial" (5 s, 10 s, 20 s… hasta 5 min)
 *   para no saturar al servidor cuando la red está inestable (RNF06).
 * - Reenviar es seguro: el servidor reconoce el `operationId` y no duplica nada (RNF05).
 */

export interface EstadoSync {
  sincronizando: boolean
  ultimaSync: string | null
  error: string | null
  proximoIntento: number | null
}

const LOTE = 100
let estado: EstadoSync = { sincronizando: false, ultimaSync: null, error: null, proximoIntento: null }
const listeners = new Set<() => void>()
let fallos = 0
let timer: number | undefined
let enCurso: Promise<void> | null = null
let iniciado = false

function actualizar(cambios: Partial<EstadoSync>) {
  estado = { ...estado, ...cambios }
  listeners.forEach(l => l())
}

export function useEstadoSync() {
  return useSyncExternalStore(
    l => { listeners.add(l); return () => { listeners.delete(l) } },
    () => estado,
  )
}

/** Programa una sincronización (agrupa varios pedidos seguidos en uno solo). */
export function sincronizarPronto(ms = 300) {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => { void sincronizar() }, ms)
}

export function sincronizar(): Promise<void> {
  if (!enCurso) enCurso = ejecutar().finally(() => { enCurso = null })
  return enCurso
}

const enviable = ({ operationId, type, idSucursal, createdAtLocal, payload }: OperacionLocal) =>
  ({ operationId, type, idSucursal, createdAtLocal, payload })

async function ejecutar() {
  const user = authSession.getSnapshot().user
  if (!navigator.onLine || !authSession.getToken() || !user?.idEmpresa) return
  const pendientes = (await offlineDb.operaciones
    .where('[idEmpresa+idUsuario]').equals([user.idEmpresa, user.idUsuario]).toArray())
    .filter(o => o.estado === 'PENDIENTE')
    .sort((a, b) => a.createdAtLocal.localeCompare(b.createdAtLocal))
  if (!pendientes.length) return

  actualizar({ sincronizando: true })
  try {
    for (let i = 0; i < pendientes.length; i += LOTE) {
      const lote = pendientes.slice(i, i + LOTE)
      await offlineDb.operaciones.bulkUpdate(lote.map(o => ({
        key: o.operationId, changes: { estado: 'ENVIANDO' as const, intentos: o.intentos + 1 },
      })))
      try {
        const { results } = await syncApi.enviar(deviceId(), lote.map(enviable))
        const ahora = new Date().toISOString()
        await offlineDb.operaciones.bulkUpdate(results.map(r => ({
          key: r.operationId,
          changes: {
            estado: r.status, serverId: r.serverId, conflictos: r.conflictos, motivo: r.reason,
            alternativas: r.alternativas, sincronizadaEn: ahora, ultimoError: undefined,
          },
        })))
      } catch (error) {
        // Nada se perdió: vuelven a PENDIENTE y se reintentan más tarde.
        await offlineDb.operaciones.bulkUpdate(lote.map(o => ({
          key: o.operationId, changes: { estado: 'PENDIENTE' as const, ultimoError: mensaje(error) },
        })))
        throw error
      }
    }
    fallos = 0
    actualizar({ sincronizando: false, ultimaSync: new Date().toISOString(), error: null, proximoIntento: null })
    void queryClient.invalidateQueries()
  } catch (error) {
    fallos += 1
    const espera = Math.min(300_000, 5_000 * 2 ** (fallos - 1))
    actualizar({ sincronizando: false, error: mensaje(error), proximoIntento: Date.now() + espera })
    sincronizarPronto(espera)
  }
}

function mensaje(error: unknown) {
  if (axios.isAxiosError(error)) {
    if (!error.response) return 'No se pudo conectar con el servidor.'
    const data = error.response.data as { code?: string; message?: string } | undefined
    if (data?.code === 'SUSCRIPCION_VENCIDA') return 'La suscripción de la empresa está vencida: se enviarán cuando se renueve.'
    if (error.response.status === 401) return 'Tu sesión expiró: vuelve a iniciar sesión para enviarlas.'
    return data?.message ?? `Error ${error.response.status} del servidor.`
  }
  return error instanceof Error ? error.message : 'Error desconocido.'
}

/** Se llama una vez al arrancar la app (main.tsx). */
export async function iniciarSincronizacion() {
  if (iniciado) return
  iniciado = true
  // Si la pestaña se cerró en pleno envío, esas operaciones vuelven a la cola (el servidor no duplica).
  try {
    const colgadas = await offlineDb.operaciones.where('estado').equals('ENVIANDO').primaryKeys()
    await offlineDb.operaciones.bulkUpdate(colgadas.map(key => ({ key, changes: { estado: 'PENDIENTE' as const } })))
  } catch { /* IndexedDB no disponible (p. ej. modo privado estricto): la app sigue en línea */ }
  window.addEventListener('online', () => { fallos = 0; sincronizarPronto(500) })
  authSession.subscribe(() => { if (authSession.getSnapshot().status === 'authenticated') sincronizarPronto(1000) })
  window.setInterval(() => { void sincronizar() }, 60_000)
  sincronizarPronto(1500)
}
