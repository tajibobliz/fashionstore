import type {
  LlamadaHerramienta,
  MensajeLlm,
  PeticionLlm,
  ProveedorLlm,
  RespuestaLlm,
} from './llm.types';
import { normalizar, sumarDias } from '../report-tools';

/**
 * Proveedor SIMULADO (`LLM_PROVIDER=simulado`): no llama a ninguna API.
 *
 * Interpreta la pregunta con reglas de palabras clave y devuelve las mismas "tool calls"
 * que devolvería un modelo real, así que el resto del arnés (validación, alcance de
 * sucursales, bitácora, tabla y gráfico) funciona igual. Sirve para:
 *   - pruebas automáticas reproducibles (sin costo ni internet),
 *   - una demostración si no hay API key o crédito.
 *
 * Para las pruebas acepta además una orden directa: `#nombre_herramienta {"param": 1}`.
 */
export class SimuladoProveedor implements ProveedorLlm {
  readonly nombre = 'simulado';

  constructor(private readonly hoy: () => string) {}

  async responder(p: PeticionLlm): Promise<RespuestaLlm> {
    const ultimo = p.mensajes[p.mensajes.length - 1];
    // Segundo turno: ya hay resultados → narrativa breve a partir de ellos.
    if (ultimo?.rol === 'resultados') return this.respuesta(narrar(ultimo), []);

    const pregunta = ultimaPregunta(p.mensajes);
    return this.respuesta(null, this.interpretar(pregunta));
  }

  private respuesta(texto: string | null, llamadas: LlamadaHerramienta[]): RespuestaLlm {
    return { texto, llamadas, modelo: 'simulado-reglas-v1', tokensEntrada: 0, tokensSalida: 0 };
  }

  private interpretar(pregunta: string): LlamadaHerramienta[] {
    const directa = /^#(\w+)\s*(\{[\s\S]*\})?\s*$/.exec(pregunta.trim());
    if (directa) {
      let entrada: Record<string, unknown> = {};
      try { entrada = directa[2] ? JSON.parse(directa[2]) : {}; } catch { entrada = { _jsonInvalido: directa[2] }; }
      return [{ id: 'sim-1', nombre: directa[1], entrada }];
    }

    const t = normalizar(pregunta);
    const fechas = this.fechas(t);
    const llamada = (nombre: string, entrada: Record<string, unknown> = {}): LlamadaHerramienta[] => [
      { id: 'sim-1', nombre, entrada },
    ];

    if (/stock|inventario|agotad|reponer/.test(t)) return llamada('stock_bajo', numero(t, /(?:menos de|menor a|umbral|bajo)\s+(\d+)/, 'umbral'));
    if (/reserva/.test(t)) return llamada('reservas_por_estado', fechas);
    if (/metodo|pago|qr|efectivo|tarjeta|transferencia/.test(t)) return llamada('ventas_por_metodo_pago', fechas);
    if (/categor/.test(t)) return llamada('ingresos_por_categoria', fechas);
    if (/producto|mas vendid|top|ranking/.test(t)) return llamada('top_productos', { ...fechas, ...numero(t, /(?:top|los)\s+(\d+)/, 'limite') });
    if (/sucursal/.test(t)) return llamada('ventas_por_sucursal', fechas);
    if (/venta|vendi|ingreso|factur/.test(t)) {
      const agrupar = /por mes|mensual|meses/.test(t) ? 'mes' : /por semana|semanal|semanas/.test(t) ? 'semana' : 'dia';
      return llamada('ventas_por_periodo', { ...fechas, agrupar });
    }
    return llamada('pedir_aclaracion', {
      pregunta: '¿Qué reporte necesitas? Por ejemplo: ventas por día, productos más vendidos, ventas por sucursal, stock bajo, reservas o métodos de pago.',
    });
  }

  /** Expresiones de fecha frecuentes; si no hay ninguna, la herramienta usa los últimos 30 días. */
  private fechas(t: string): Record<string, string> {
    const hoy = this.hoy();
    if (/\bhoy\b/.test(t)) return { desde: hoy, hasta: hoy };
    if (/\bayer\b/.test(t)) { const a = sumarDias(hoy, -1); return { desde: a, hasta: a }; }
    const n = /ultim[oa]s?\s+(\d+)\s+dias/.exec(t);
    if (n) return { desde: sumarDias(hoy, -(Number(n[1]) - 1)), hasta: hoy };
    if (/esta semana/.test(t)) return { desde: sumarDias(hoy, -((new Date(`${hoy}T00:00:00Z`).getUTCDay() + 6) % 7)), hasta: hoy };
    if (/este mes/.test(t)) return { desde: `${hoy.slice(0, 8)}01`, hasta: hoy };
    if (/mes pasado|mes anterior/.test(t)) {
      const fin = sumarDias(`${hoy.slice(0, 8)}01`, -1);
      return { desde: `${fin.slice(0, 8)}01`, hasta: fin };
    }
    if (/este ano/.test(t)) return { desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy };
    return {};
  }
}

function ultimaPregunta(mensajes: MensajeLlm[]) {
  for (let i = mensajes.length - 1; i >= 0; i--) {
    const m = mensajes[i];
    if (m.rol === 'usuario') return m.texto;
  }
  return '';
}

function numero(t: string, re: RegExp, clave: string) {
  const m = re.exec(t);
  return m ? { [clave]: Number(m[1]) } : {};
}

/** Narrativa con los totales que calculó el backend (nunca inventa cifras). */
function narrar(m: Extract<MensajeLlm, { rol: 'resultados' }>) {
  const partes = m.resultados.map((r) => {
    if (r.esError) return `No se pudo generar el reporte: ${r.contenido}`;
    const d = JSON.parse(r.contenido) as { titulo: string; resumen: Record<string, number>; filas: Record<string, unknown>[] };
    if (!d.filas.length) return `${d.titulo}: no hay datos para los filtros elegidos.`;
    const total = d.resumen.totalVendido ?? d.resumen.monto ?? d.resumen.totalGenerado;
    const primero = Object.values(d.filas[0])[0];
    const extra = total !== undefined ? ` con un total de Bs ${total.toFixed(2)}` : '';
    return `${d.titulo}: ${d.resumen.filas ?? d.filas.length} filas${extra}. El primer registro es ${String(primero)}.`;
  });
  return partes.join(' ');
}
