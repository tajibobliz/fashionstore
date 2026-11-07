/**
 * Monedas que una tienda puede usar (código ISO 4217).
 *
 * Regla del SaaS: los PLANES de la plataforma se cobran en USD (igual para todos los países);
 * cada TIENDA vende en su propia moneda (`empresa.moneda`), que no depende de dónde esté
 * quien mira la página sino de quién vende. Cambiar la moneda no convierte precios: solo
 * cambia cómo se muestran y cobran los montos de esa tienda.
 */
export interface Moneda {
  codigo: string;
  nombre: string;
  simbolo: string;
  decimales: number;
}

export const MONEDAS: Moneda[] = [
  { codigo: 'BOB', nombre: 'Boliviano', simbolo: 'Bs', decimales: 2 },
  {
    codigo: 'USD',
    nombre: 'Dólar estadounidense',
    simbolo: 'US$',
    decimales: 2,
  },
  { codigo: 'ARS', nombre: 'Peso argentino', simbolo: '$', decimales: 2 },
  { codigo: 'BRL', nombre: 'Real brasileño', simbolo: 'R$', decimales: 2 },
  { codigo: 'CLP', nombre: 'Peso chileno', simbolo: '$', decimales: 0 },
  { codigo: 'COP', nombre: 'Peso colombiano', simbolo: '$', decimales: 0 },
  { codigo: 'EUR', nombre: 'Euro', simbolo: '€', decimales: 2 },
  { codigo: 'MXN', nombre: 'Peso mexicano', simbolo: '$', decimales: 2 },
  { codigo: 'PEN', nombre: 'Sol peruano', simbolo: 'S/', decimales: 2 },
  { codigo: 'PYG', nombre: 'Guaraní', simbolo: '₲', decimales: 0 },
];

export const CODIGOS_MONEDA = MONEDAS.map((m) => m.codigo);
export const MONEDA_POR_DEFECTO = 'BOB';
/** Moneda en la que la plataforma cobra los planes. */
export const MONEDA_PLANES = 'USD';

export function moneda(codigo?: string | null): Moneda {
  return MONEDAS.find((m) => m.codigo === codigo) ?? MONEDAS[0];
}

/** "Bs 1.234,50", "US$ 29,00", "$ 15.990" (CLP sin decimales). */
export function formatearMonto(valor: number, codigo?: string | null): string {
  const m = moneda(codigo);
  const n = Number(valor).toLocaleString('es-BO', {
    minimumFractionDigits: m.decimales,
    maximumFractionDigits: m.decimales,
  });
  return `${m.simbolo} ${n}`;
}
