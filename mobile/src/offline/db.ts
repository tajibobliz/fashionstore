import * as SQLite from "expo-sqlite";
import type { SQLiteDatabase } from "expo-sqlite";

/**
 * Base de datos local del teléfono (SQLite) para trabajar sin conexión — Fase 2, Desafío III.
 *
 * SQLite es una base de datos relacional que vive en un archivo dentro del dispositivo:
 * se mantiene aunque se cierre la app. Las claves foráneas están activas
 * (PRAGMA foreign_keys = ON) para que, por ejemplo, no exista inventario de una variante
 * que no está guardada.
 *
 * Todo lleva `id_empresa`: el mismo teléfono puede usarse con cuentas de distintas tiendas.
 */

const NOMBRE = "fashionstore-offline.db";
const VERSION = 1;

let abierta: Promise<SQLiteDatabase> | null = null;

/** Abre la base una sola vez (y aplica las migraciones pendientes). */
export function db(): Promise<SQLiteDatabase> {
  if (!abierta) {
    abierta = (async () => {
      const base = await SQLite.openDatabaseAsync(NOMBRE);
      await base.execAsync("PRAGMA foreign_keys = ON;");
      await migrar(base);
      return base;
    })().catch((error) => {
      abierta = null;
      throw error;
    });
  }
  return abierta;
}

/**
 * Migraciones con PRAGMA user_version: el número de versión se guarda en el propio archivo.
 * Para cambiar el esquema en el futuro se agrega un bloque `if (actual < 2) { ... }`.
 */
async function migrar(base: SQLiteDatabase) {
  const fila = await base.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  const actual = fila?.user_version ?? 0;
  if (actual >= VERSION) return;

  if (actual < 1) {
    await base.execAsync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS sucursal (
        id_empresa  INTEGER NOT NULL,
        id_sucursal INTEGER NOT NULL,
        nombre      TEXT    NOT NULL,
        server_time TEXT    NOT NULL,   -- hora del servidor al descargar (regla de precios)
        guardado_en TEXT    NOT NULL,
        PRIMARY KEY (id_empresa, id_sucursal)
      );

      CREATE TABLE IF NOT EXISTS producto (
        id_empresa   INTEGER NOT NULL,
        id_producto  INTEGER NOT NULL,
        nombre       TEXT    NOT NULL,
        categoria    TEXT,
        imagen_url   TEXT,
        precio       REAL    NOT NULL,
        precio_final REAL    NOT NULL,  -- con promociones vigentes
        PRIMARY KEY (id_empresa, id_producto)
      );

      CREATE TABLE IF NOT EXISTS variante (
        id_empresa  INTEGER NOT NULL,
        id_variante INTEGER NOT NULL,
        id_producto INTEGER NOT NULL,
        sku         TEXT    NOT NULL,
        talla       TEXT,
        color       TEXT,
        PRIMARY KEY (id_empresa, id_variante),
        FOREIGN KEY (id_empresa, id_producto) REFERENCES producto (id_empresa, id_producto) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS inventario_local (
        id_empresa  INTEGER NOT NULL,
        id_sucursal INTEGER NOT NULL,
        id_variante INTEGER NOT NULL,
        stock       INTEGER NOT NULL CHECK (stock >= 0),
        PRIMARY KEY (id_empresa, id_sucursal, id_variante),
        FOREIGN KEY (id_empresa, id_sucursal) REFERENCES sucursal (id_empresa, id_sucursal) ON DELETE CASCADE,
        FOREIGN KEY (id_empresa, id_variante) REFERENCES variante (id_empresa, id_variante) ON DELETE CASCADE
      );

      -- Cola de operaciones hechas sin conexión. Estados:
      -- PENDIENTE -> ENVIANDO -> CONFIRMADA | RECHAZADA | CONFLICTO (vuelve a PENDIENTE si falla la red)
      CREATE TABLE IF NOT EXISTS operacion_pendiente (
        operation_id     TEXT    PRIMARY KEY NOT NULL,  -- UUID: llave de idempotencia en el servidor
        id_empresa       INTEGER NOT NULL,
        id_usuario       INTEGER NOT NULL,
        tipo             TEXT    NOT NULL CHECK (tipo IN ('VENTA', 'RESERVA')),
        id_sucursal      INTEGER NOT NULL,
        created_at_local TEXT    NOT NULL,
        payload          TEXT    NOT NULL,              -- JSON con los detalles
        resumen          TEXT    NOT NULL,
        estado           TEXT    NOT NULL CHECK (estado IN ('PENDIENTE','ENVIANDO','CONFIRMADA','RECHAZADA','CONFLICTO')),
        intentos         INTEGER NOT NULL DEFAULT 0,
        ultimo_error     TEXT,
        server_id        INTEGER,
        conflictos       TEXT,
        motivo           TEXT,
        alternativas     TEXT,                          -- JSON
        sincronizada_en  TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_operacion_usuario ON operacion_pendiente (id_empresa, id_usuario, estado);

      -- Bitácora de cada intento de sincronización (observabilidad, sin datos personales).
      CREATE TABLE IF NOT EXISTS sync_log (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha       TEXT    NOT NULL,
        enviadas    INTEGER NOT NULL,
        confirmadas INTEGER NOT NULL,
        conflictos  INTEGER NOT NULL,
        rechazadas  INTEGER NOT NULL,
        error       TEXT
      );
    `);
  }

  await base.execAsync(`PRAGMA user_version = ${VERSION}`);
}
