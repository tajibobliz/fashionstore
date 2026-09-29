// #ad3e68 es --app-primary (DashboardLayout.module.css), el mismo rosa de marca que usa el resto del
// admin. Las siguientes son variaciones para series/segmentos adicionales en los mismos tonos.
export const CHART_PRIMARY = '#ad3e68'
export const CHART_PALETTE = ['#ad3e68', '#e94560', '#f27587', '#7d1f38', '#c2185b', '#f7a7b1']

export function money(value: number) {
  return `Bs ${value.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
