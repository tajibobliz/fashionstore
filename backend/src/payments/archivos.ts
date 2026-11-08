import { BadRequestException } from '@nestjs/common';

export const MIME_IMAGEN = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const MIME_COMPROBANTE = [...MIME_IMAGEN, 'application/pdf'] as const;

/** Firmas ("magic bytes") de cada formato: el tipo declarado tiene que coincidir con el contenido. */
const FIRMAS: Record<string, (b: Buffer) => boolean> = {
  'image/png': (b) =>
    b
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/webp': (b) =>
    b.subarray(0, 4).toString('latin1') === 'RIFF' &&
    b.subarray(8, 12).toString('latin1') === 'WEBP',
  'application/pdf': (b) => b.subarray(0, 5).toString('latin1') === '%PDF-',
};

/**
 * Convierte el archivo enviado en base64 (con o sin prefijo `data:...;base64,`) y valida
 * tipo, tamaño y contenido. Así no se guarda un ejecutable con extensión .png.
 */
export function decodificarArchivo(
  base64: string,
  mime: string,
  maxBytes: number,
  permitidos: readonly string[],
) {
  if (!permitidos.includes(mime))
    throw new BadRequestException(
      `Tipo de archivo no permitido (${mime}). Usa ${permitidos.join(', ')}.`,
    );
  const limpio = base64.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(limpio))
    throw new BadRequestException('El archivo no está en base64 válido');
  const datos = Buffer.from(limpio, 'base64');
  if (!datos.length) throw new BadRequestException('El archivo está vacío');
  if (datos.length > maxBytes)
    throw new BadRequestException(
      `El archivo pesa ${(datos.length / 1048576).toFixed(1)} MB; el máximo es ${(maxBytes / 1048576).toFixed(1)} MB.`,
    );
  if (!FIRMAS[mime]?.(datos))
    throw new BadRequestException(
      'El contenido del archivo no corresponde a su tipo',
    );
  return datos;
}
