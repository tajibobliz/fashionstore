/**
 * Fechas "de calendario" (AAAA-MM-DD) en la zona horaria de la tienda (APP_TIMEZONE).
 * La base guarda las fechas en UTC; Bolivia es UTC-4, así que el día 7 de noviembre en La Paz
 * va de 2026-11-07T04:00Z a 2026-11-08T03:59:59.999Z. Si se cortara el día en UTC, lo vendido
 * después de las 20:00 quedaría fuera de los reportes de "hoy".
 */
export const FECHA_SIMPLE = /^\d{4}-\d{2}-\d{2}$/;

/** Zona de la tienda; se valida con Intl (lanza error si el nombre no existe). */
export function zonaApp(): string {
  const zona = process.env.APP_TIMEZONE || 'America/La_Paz';
  new Intl.DateTimeFormat('en-US', { timeZone: zona });
  return zona;
}

/** Diferencia (ms) entre la hora local de la zona y UTC en ese instante. */
function desfase(instante: Date, zona: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: zona,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(instante)
      .map((x) => [x.type, x.value]),
  );
  const comoUtc = Date.UTC(
    +p.year,
    +p.month - 1,
    +p.day,
    +p.hour,
    +p.minute,
    +p.second,
  );
  return comoUtc - Math.floor(instante.getTime() / 1000) * 1000;
}

/** Instante en que empieza el día `fecha` en la zona (00:00 local). */
export function inicioDelDia(fecha: string, zona = zonaApp()): Date {
  const [a, m, d] = fecha.split('-').map(Number);
  const base = Date.UTC(a, m - 1, d);
  let t = base - desfase(new Date(base), zona);
  const ajuste = desfase(new Date(t), zona); // por si ese día cambia el horario de verano
  if (ajuste !== base - t) t = base - ajuste;
  return new Date(t);
}

/** Último milisegundo del día `fecha` en la zona (23:59:59.999 local). */
export function finDelDia(fecha: string, zona = zonaApp()): Date {
  const [a, m, d] = fecha.split('-').map(Number);
  const siguiente = new Date(Date.UTC(a, m - 1, d + 1))
    .toISOString()
    .slice(0, 10);
  return new Date(inicioDelDia(siguiente, zona).getTime() - 1);
}

/** Nombre de la zona listo para ir dentro de SQL (`... AT TIME ZONE 'America/La_Paz'`). */
export const zonaSql = () => `'${zonaApp().replace(/'/g, "''")}'`;
