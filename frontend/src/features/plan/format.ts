/** '2026-11-25' → '25 de noviembre de 2026' (sin desfase de zona horaria). */
export function formatoFecha(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' })
}
