import * as Crypto from "expo-crypto";

/**
 * Genera un UUID v4 usando expo-crypto.
 * Usado para `clientRequestId` en operaciones idempotentes.
 */
export function generateUUID(): string {
  return Crypto.randomUUID();
}