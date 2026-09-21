/**
 * Redondea un monto a 2 decimales (centavos).
 * Evita el problema clásico de precisión IEEE 754:
 *   0.1 + 0.2 = 0.30000000000000004
 *   299.90 * 3 = 899.6999999999999
 * 
 * Uso: toMoney(299.90 * 3)  →  899.7
 */
export function toMoney(value: number): number {
  return Math.round(value * 100) / 100;
}