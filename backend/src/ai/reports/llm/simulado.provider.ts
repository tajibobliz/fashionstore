import type {
  LlamadaHerramienta,
  MensajeLlm,
  PeticionLlm,
  ProveedorLlm,
  RespuestaLlm,
} from './llm.types';
import { normalizar, sumarDias } from '../report-tools';
import { formatearMonto } from '../../../common/monedas';

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

    // Reportes a medida: talla, color, orden o columnas concretas.
    const flexible = aMedida(t);
    if (flexible) return llamada(flexible.nombre, flexible.nombre === 'consulta_ventas' ? { ...fechas, ...flexible.entrada } : flexible.entrada);

    if (/motivo|por que (devuelv|cambi)|razon/.test(t)) {
      const tipo = /devol|devuel/.test(t) && !/cambi/.test(t) ? 'devoluciones' : /cambi/.test(t) && !/devol|devuel/.test(t) ? 'cambios' : 'ambos';
      return llamada('motivos_devolucion_y_cambio', { ...fechas, tipo });
    }
    if (/devol|devuel|cambiad|cambio de prenda|cambios/.test(t)) return llamada('devoluciones_y_cambios_por_producto', fechas);
    if (/stock|inventario|agotad|reponer/.test(t)) return llamada('stock_bajo', numero(t, /(?:menos de|menor a|umbral|bajo)\s+(\d+)/, 'umbral'));
    if (/reserva/.test(t)) return llamada('reservas_por_estado', fechas);
    if (/metodo|pago|qr|efectivo|tarjeta|transferencia/.test(t)) return llamada('ventas_por_metodo_pago', fechas);
    if (/categor/.test(t)) return llamada('ingresos_por_categoria', fechas);
    if (/producto|mas vendid|top|ranking/.test(t))
      return llamada('top_productos', {
        ...fechas,
        ...numero(t, /(?:top|los)\s+(\d+)/, 'limite'),
        ...(/sucursal/.test(t) ? { porSucursal: true } : {}),
      });
    if (/sucursal/.test(t)) return llamada('ventas_por_sucursal', fechas);
    if (/venta|vendi|ingreso|factur/.test(t)) {
      const agrupar = /por mes|mensual|meses/.test(t) ? 'mes' : /por semana|semanal|semanas/.test(t) ? 'semana' : 'dia';
      return llamada('ventas_por_periodo', { ...fechas, agrupar });
    }
    return llamada('pedir_aclaracion', {
      pregunta: '¿Qué reporte necesitas? Por ejemplo: ventas por día, productos más vendidos, ventas por sucursal, stock bajo, reservas, métodos de pago o prendas devueltas y cambiadas.',
    });
  }

  /** Expresiones de fecha frecuentes; si no hay ninguna, la herramienta usa los últimos 30 días. */
  private fechas(t: string): Record<string, string> {
    const hoy = this.hoy();
    // Fechas explícitas: "desde 2025-01-01" y/o "hasta 2025-06-30".
    const desde = /desde\s+(\d{4}-\d{2}-\d{2})/.exec(t)?.[1];
    const hasta = /hasta\s+(\d{4}-\d{2}-\d{2})/.exec(t)?.[1];
    if (desde || hasta) return { ...(desde ? { desde } : {}), hasta: hasta ?? hoy };
    if (/\bhoy\b/.test(t)) return { desde: hoy, hasta: hoy };
    if (/\bayer\b/.test(t)) { const a = sumarDias(hoy, -1); return { desde: a, hasta: a }; }
    const n = /ultim[oa]s?\s+(\d+)\s+dias/.exec(t);
    if (n) return { desde: sumarDias(hoy, -(Number(n[1]) - 1)), hasta: hoy };
    const m = /ultim[oa]s?\s+(\d+)\s+meses/.exec(t);
    if (m) return { desde: restarMeses(hoy, Number(m[1])), hasta: hoy };
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

/** Misma fecha N meses antes (si ese día no existe, el último día de ese mes). */
function restarMeses(fecha: string, meses: number) {
  const [a, m, d] = fecha.split('-').map(Number);
  const total = a * 12 + (m - 1) - meses;
  const anio = Math.floor(total / 12);
  const mes = total % 12;
  const ultimo = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  return `${anio}-${String(mes + 1).padStart(2, '0')}-${String(Math.min(d, ultimo)).padStart(2, '0')}`;
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
const COLORES = ['negro', 'blanco', 'azul', 'rojo', 'rosado', 'rosa', 'verde', 'gris', 'beige', 'cafe', 'marron', 'dorado', 'plateado', 'amarillo', 'morado', 'celeste', 'naranja', 'crema', 'nude', 'fucsia', 'turquesa'];
const CATEGORIAS: Record<string, string> = {
  vestido: 'Vestidos', zapato: 'Zapatos', calzado: 'Zapatos', cartera: 'Carteras', bolso: 'Carteras', polera: 'Poleras', blusa: 'Blusas',
  accesorio: 'Accesorios', gorra: 'Gorras', pantalon: 'Pantalones', falda: 'Faldas', chaqueta: 'Chaquetas', lente: 'Lentes',
};
const TALLA = /^(xxs|xs|s|m|l|xl|xxl|unica|\d{2})$/;
const capital = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

/**
 * Pedido "a medida" (consulta_ventas / consulta_inventario) con reglas de palabras clave:
 * tallas, colores, categorías, "por talla/color/sucursal", orden y "solo la cantidad".
 */
function aMedida(t: string): { nombre: string; entrada: Record<string, unknown> } | null {
  if (!/talla|color|ascendente|descendente|menor a mayor|mayor a menor|ordenad|columna|solo (la|las|el|los) /.test(t)) return null;
  const inventario = /stock|inventario|quedan|disponible|existencia/.test(t);
  const tallas = [...new Set([...t.matchAll(/tallas?\s+([a-z0-9]+(?:\s*(?:,|y|o)\s*[a-z0-9]+)*)/g)]
    .flatMap((m) => m[1].split(/\s*(?:,|\by\b|\bo\b)\s*/)).filter((x) => TALLA.test(x)).map((x) => x.toUpperCase()))];
  const colores = COLORES.filter((c) => new RegExp(`\\b${c}s?\\b`).test(t)).map(capital);
  const categorias = [...new Set(Object.keys(CATEGORIAS).filter((k) => new RegExp(`\\b${k}(e?s)?\\b`).test(t)).map((k) => CATEGORIAS[k]))];
  const agrupar: string[] = [];
  if (/producto|prenda|articulo/.test(t)) agrupar.push('producto');
  if (tallas.length || /talla/.test(t)) agrupar.push('talla');
  if (colores.length || /color/.test(t)) agrupar.push('color');
  if (/sucursal/.test(t)) agrupar.push('sucursal');
  if (!agrupar.length) agrupar.push('producto');
  let metricas: string[];
  if (inventario) metricas = ['stockDisponible'];
  else if (/solo (la |las )?(cantidad|unidades)/.test(t)) metricas = ['unidades'];
  else if (/solo (el |los )?(ingreso|monto|total)/.test(t)) metricas = ['ingreso'];
  else metricas = ['unidades', 'ingreso'];
  const direccion = /ascendente|menor a mayor|de menos a mas/.test(t) ? 'asc' : /descendente|mayor a menor/.test(t) ? 'desc' : undefined;
  const limite = /(?:top|los|las|primer[oa]s)\s+(\d+)/.exec(t);
  const entrada: Record<string, unknown> = { agrupar, metricas };
  if (tallas.length) entrada.tallas = tallas;
  if (colores.length) entrada.colores = colores;
  if (categorias.length) entrada.categorias = categorias;
  if (direccion) { entrada.direccion = direccion; entrada.ordenarPor = metricas[0]; }
  if (limite) entrada.limite = Math.min(1000, Number(limite[1]));
  return { nombre: inventario ? 'consulta_inventario' : 'consulta_ventas', entrada };
}

function narrar(m: Extract<MensajeLlm, { rol: 'resultados' }>) {
  const partes = m.resultados.map((r) => {
    if (r.esError) return `No se pudo generar el reporte: ${r.contenido}`;
    const d = JSON.parse(r.contenido) as { titulo: string; resumen: Record<string, number>; filas: Record<string, unknown>[]; moneda?: string };
    const monto = (n: number) => formatearMonto(n, d.moneda);
    if (!d.filas.length) return `${d.titulo}: no hay datos para los filtros elegidos.`;
    if ('tasaDevolucion' in d.resumen) {
      const r = d.resumen;
      const top = d.filas[0] as { producto: string; unidadesDevueltas: number; unidadesCambiadas: number };
      return `De ${r.unidadesVendidas} unidades vendidas, se devolvieron ${r.unidadesDevueltas} (${r.tasaDevolucion}%) y se cambiaron ${r.unidadesCambiadas} (${r.tasaCambio}%). La prenda con más devoluciones y cambios es ${top.producto} (${top.unidadesDevueltas} devueltas y ${top.unidadesCambiadas} cambiadas).`;
    }
    if ('variantes' in d.resumen)
      return `Hay ${d.resumen.variantes} variantes con stock bajo; ${d.resumen.agotadas} están agotadas. La de menor stock es ${String(d.filas[0].producto)} (${String(d.filas[0].stockDisponible)} unidades).`;
    const metrica = ['totalVendido', 'monto', 'totalGenerado', 'ingreso', 'cantidadVendida', 'unidades', 'stockDisponible', 'stockTotal', 'unidadesDevueltas', 'operaciones', 'cantidad'].find((k) => typeof d.filas[0][k] === 'number');
    const etiqueta = Object.keys(d.filas[0]).find((k) => typeof d.filas[0][k] === 'string');
    if (!metrica || !etiqueta) return `${d.titulo}: ${d.filas.length} filas.`;
    const total = d.filas.reduce((s, f) => s + Number(f[metrica]), 0);
    const mayor = d.filas.reduce((a, b) => (Number(b[metrica]) > Number(a[metrica]) ? b : a));
    const esMonto = ['totalVendido', 'monto', 'totalGenerado', 'ingreso'].includes(metrica);
    const valor = (n: number) => (esMonto ? monto(n) : `${n}`);
    const pct = total ? Math.round((Number(mayor[metrica]) / total) * 100) : 0;
    return `${d.titulo}: ${d.filas.length} ${d.filas.length === 1 ? 'registro' : 'registros'} con un total de ${valor(total)}. El mayor es ${String(mayor[etiqueta])} con ${valor(Number(mayor[metrica]))} (${pct}% del total).`;
  });
  return partes.join(' ');
}
