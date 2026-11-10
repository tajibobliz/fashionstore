import { AppState } from "react-native";
import * as SecureStore from "expo-secure-store";
import { AxiosError } from "axios";
import { useSyncExternalStore } from "react";
import { syncService } from "@/services/sync.service";
import { generateUUID } from "@/lib/uuid";
import type { User } from "@/types";
import { db } from "./db";
import { hayConexion, alVolverLaConexion } from "./network";
import { avisarCambios, pendientesDe } from "./queue";
import type { OperacionLocal } from "./queue";

/**
 * Motor de sincronización del teléfono (mismo contrato que la web, §6.2 del plan):
 * envía las operaciones PENDIENTES del usuario a POST /sync/operations.
 *
 * - Se dispara al volver la conexión, al volver la app a primer plano, al encolar y cada minuto.
 * - Si falla, reintenta con backoff exponencial (5 s, 10 s, 20 s… hasta 5 min).
 * - Reenviar es seguro: el servidor reconoce el operationId (idempotencia).
 */

export interface EstadoSync {
  sincronizando: boolean;
  ultimaSync: string | null;
  error: string | null;
}

const LOTE = 100;
let estado: EstadoSync = { sincronizando: false, ultimaSync: null, error: null };
const oyentes = new Set<() => void>();
let fallos = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let enCurso: Promise<void> | null = null;
let iniciado = false;

function actualizar(cambios: Partial<EstadoSync>) {
  estado = { ...estado, ...cambios };
  oyentes.forEach((o) => o());
}

export function useEstadoSync() {
  return useSyncExternalStore(
    (o) => { oyentes.add(o); return () => { oyentes.delete(o); }; },
    () => estado,
  );
}

export function sincronizarPronto(ms = 300) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { void sincronizar(); }, ms);
}

export function sincronizar(): Promise<void> {
  if (!enCurso) enCurso = ejecutar().finally(() => { enCurso = null; });
  return enCurso;
}

async function idDispositivo() {
  let id = await SecureStore.getItemAsync("device_id");
  if (!id) {
    id = `movil-${generateUUID()}`;
    await SecureStore.setItemAsync("device_id", id);
  }
  return id;
}

async function usuarioActual(): Promise<User | null> {
  const token = await SecureStore.getItemAsync("access_token");
  const json = await SecureStore.getItemAsync("user");
  return token && json ? (JSON.parse(json) as User) : null;
}

const enviable = (o: OperacionLocal) => ({
  operationId: o.operationId, type: o.tipo, idSucursal: o.idSucursal, createdAtLocal: o.createdAtLocal, payload: o.payload,
});

async function ejecutar() {
  const user = await usuarioActual();
  if (!user?.idEmpresa || !(await hayConexion())) return;
  const pendientes = await pendientesDe(user.idEmpresa, user.idUsuario);
  if (!pendientes.length) return;

  const base = await db();
  const deviceId = await idDispositivo();
  actualizar({ sincronizando: true });
  const cuenta = { enviadas: 0, confirmadas: 0, conflictos: 0, rechazadas: 0 };
  try {
    for (let i = 0; i < pendientes.length; i += LOTE) {
      const lote = pendientes.slice(i, i + LOTE);
      const ids = lote.map((o) => o.operationId);
      const marcas = ids.map(() => "?").join(",");
      await base.runAsync(
        `UPDATE operacion_pendiente SET estado = 'ENVIANDO', intentos = intentos + 1 WHERE operation_id IN (${marcas})`,
        ...ids,
      );
      avisarCambios();
      try {
        const { results } = await syncService.enviar(deviceId, lote.map(enviable));
        const ahora = new Date().toISOString();
        await base.withTransactionAsync(async () => {
          for (const r of results) {
            await base.runAsync(
              `UPDATE operacion_pendiente SET estado = ?, server_id = ?, conflictos = ?, motivo = ?, alternativas = ?,
                 sincronizada_en = ?, ultimo_error = NULL WHERE operation_id = ?`,
              r.status, r.serverId, r.conflictos.join(",") || null, r.reason,
              r.alternativas?.length ? JSON.stringify(r.alternativas) : null, ahora, r.operationId,
            );
            cuenta.enviadas += 1;
            if (r.status === "CONFIRMADA") cuenta.confirmadas += 1;
            else if (r.status === "CONFLICTO") cuenta.conflictos += 1;
            else cuenta.rechazadas += 1;
          }
        });
      } catch (error) {
        // Nada se pierde: vuelven a PENDIENTE para el próximo intento.
        await base.runAsync(
          `UPDATE operacion_pendiente SET estado = 'PENDIENTE', ultimo_error = ? WHERE operation_id IN (${marcas})`,
          mensaje(error), ...ids,
        );
        throw error;
      }
    }
    fallos = 0;
    await registrar(cuenta, null);
    actualizar({ sincronizando: false, ultimaSync: new Date().toISOString(), error: null });
  } catch (error) {
    fallos += 1;
    await registrar(cuenta, mensaje(error));
    actualizar({ sincronizando: false, error: mensaje(error) });
    sincronizarPronto(Math.min(300_000, 5_000 * 2 ** (fallos - 1)));
  } finally {
    avisarCambios();
  }
}

async function registrar(c: { enviadas: number; confirmadas: number; conflictos: number; rechazadas: number }, error: string | null) {
  try {
    const base = await db();
    await base.runAsync(
      "INSERT INTO sync_log (fecha, enviadas, confirmadas, conflictos, rechazadas, error) VALUES (?, ?, ?, ?, ?, ?)",
      new Date().toISOString(), c.enviadas, c.confirmadas, c.conflictos, c.rechazadas, error,
    );
  } catch { /* la bitácora nunca debe romper la sincronización */ }
}

function mensaje(error: unknown) {
  const e = error as AxiosError<{ code?: string; message?: string }>;
  if (e?.isAxiosError) {
    if (!e.response) return "No se pudo conectar con el servidor.";
    if (e.response.data?.code === "SUSCRIPCION_VENCIDA") return "La suscripción de la tienda está vencida: se enviarán cuando se renueve.";
    if (e.response.status === 401) return "Tu sesión expiró: vuelve a iniciar sesión para enviarlas.";
    return e.response.data?.message ?? `Error ${e.response.status} del servidor.`;
  }
  return error instanceof Error ? error.message : "Error desconocido.";
}

/** Se llama una vez al arrancar la app (app/_layout.tsx). */
export async function iniciarSincronizacion() {
  if (iniciado) return;
  iniciado = true;
  try {
    // Si la app se cerró en pleno envío, esas operaciones vuelven a la cola (el servidor no duplica).
    const base = await db();
    await base.runAsync("UPDATE operacion_pendiente SET estado = 'PENDIENTE' WHERE estado = 'ENVIANDO'");
  } catch (error) {
    console.warn("[offline] No se pudo abrir la base local:", error);
  }
  alVolverLaConexion(() => { fallos = 0; sincronizarPronto(500); });
  AppState.addEventListener("change", (s) => { if (s === "active") sincronizarPronto(500); });
  setInterval(() => { void sincronizar(); }, 60_000);
  sincronizarPronto(2000);
}
