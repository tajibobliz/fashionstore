import { useEffect, useState } from "react";
import { generateUUID } from "@/lib/uuid";
import type { Alternativa, PayloadOperacion, TipoOperacion } from "@/services/sync.service";
import { db } from "./db";

export type EstadoLocal = "PENDIENTE" | "ENVIANDO" | "CONFIRMADA" | "RECHAZADA" | "CONFLICTO";

export interface OperacionLocal {
  operationId: string;
  idEmpresa: number;
  idUsuario: number;
  tipo: TipoOperacion;
  idSucursal: number;
  createdAtLocal: string;
  payload: PayloadOperacion;
  resumen: string;
  estado: EstadoLocal;
  intentos: number;
  ultimoError: string | null;
  serverId: number | null;
  conflictos: string[];
  motivo: string | null;
  alternativas: Alternativa[];
  sincronizadaEn: string | null;
}

// ---- Aviso de cambios: las pantallas se refrescan cuando la cola cambia ----
const oyentes = new Set<() => void>();
export function avisarCambios() {
  oyentes.forEach((o) => o());
}
export function alCambiarLaCola(oyente: () => void) {
  oyentes.add(oyente);
  return () => { oyentes.delete(oyente); };
}

type Fila = {
  operation_id: string; id_empresa: number; id_usuario: number; tipo: TipoOperacion; id_sucursal: number;
  created_at_local: string; payload: string; resumen: string; estado: EstadoLocal; intentos: number;
  ultimo_error: string | null; server_id: number | null; conflictos: string | null; motivo: string | null;
  alternativas: string | null; sincronizada_en: string | null;
};

const desdeFila = (f: Fila): OperacionLocal => ({
  operationId: f.operation_id,
  idEmpresa: f.id_empresa,
  idUsuario: f.id_usuario,
  tipo: f.tipo,
  idSucursal: f.id_sucursal,
  createdAtLocal: f.created_at_local,
  payload: JSON.parse(f.payload),
  resumen: f.resumen,
  estado: f.estado,
  intentos: f.intentos,
  ultimoError: f.ultimo_error,
  serverId: f.server_id,
  conflictos: f.conflictos ? f.conflictos.split(",") : [],
  motivo: f.motivo,
  alternativas: f.alternativas ? JSON.parse(f.alternativas) : [],
  sincronizadaEn: f.sincronizada_en,
});

/**
 * Guarda una reserva (o venta) hecha sin conexión. El `operationId` se crea aquí una sola
 * vez: aunque la app la envíe varias veces, el servidor la registra una sola vez.
 */
export async function encolar(op: {
  tipo: TipoOperacion; idEmpresa: number; idUsuario: number; idSucursal: number; payload: PayloadOperacion; resumen: string;
}) {
  const base = await db();
  const operationId = generateUUID();
  await base.runAsync(
    `INSERT INTO operacion_pendiente (operation_id, id_empresa, id_usuario, tipo, id_sucursal, created_at_local, payload, resumen, estado)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDIENTE')`,
    operationId, op.idEmpresa, op.idUsuario, op.tipo, op.idSucursal, new Date().toISOString(), JSON.stringify(op.payload), op.resumen,
  );
  avisarCambios();
  return operationId;
}

export async function operacionesDe(idEmpresa: number, idUsuario: number) {
  const base = await db();
  const filas = await base.getAllAsync<Fila>(
    "SELECT * FROM operacion_pendiente WHERE id_empresa = ? AND id_usuario = ? ORDER BY created_at_local DESC",
    idEmpresa, idUsuario,
  );
  return filas.map(desdeFila);
}

export async function pendientesDe(idEmpresa: number, idUsuario: number) {
  const base = await db();
  const filas = await base.getAllAsync<Fila>(
    "SELECT * FROM operacion_pendiente WHERE id_empresa = ? AND id_usuario = ? AND estado = 'PENDIENTE' ORDER BY created_at_local",
    idEmpresa, idUsuario,
  );
  return filas.map(desdeFila);
}

/** Quita de la lista una operación ya resuelta por el servidor (no borra nada en el servidor). */
export async function descartar(operationId: string) {
  const base = await db();
  await base.runAsync(
    "DELETE FROM operacion_pendiente WHERE operation_id = ? AND estado IN ('CONFIRMADA','RECHAZADA','CONFLICTO')",
    operationId,
  );
  avisarCambios();
}

export async function limpiarConfirmadas(idEmpresa: number, idUsuario: number) {
  const base = await db();
  await base.runAsync(
    "DELETE FROM operacion_pendiente WHERE id_empresa = ? AND id_usuario = ? AND estado = 'CONFIRMADA'",
    idEmpresa, idUsuario,
  );
  avisarCambios();
}

/** Hook: operaciones del usuario actual, se refresca solo cuando la cola cambia. */
export function useOperaciones(idEmpresa: number | null | undefined, idUsuario: number | null | undefined) {
  const [ops, setOps] = useState<OperacionLocal[]>([]);
  useEffect(() => {
    if (!idEmpresa || !idUsuario) return;
    let vigente = true;
    const leer = () => {
      operacionesDe(idEmpresa, idUsuario)
        .then((filas) => { if (vigente) setOps(filas); })
        .catch(() => { if (vigente) setOps([]); });
    };
    leer();
    const dejar = alCambiarLaCola(leer);
    return () => { vigente = false; dejar(); };
  }, [idEmpresa, idUsuario]);
  return idEmpresa && idUsuario ? ops : [];
}
