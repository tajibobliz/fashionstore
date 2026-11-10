import { jest } from '@jest/globals';
import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import { AiReportsService, hoyEn } from './ai-reports.service';
import { ReportToolsService } from './report-tools';
import { AnthropicProveedor } from './llm/anthropic.provider';
import { SimuladoProveedor } from './llm/simulado.provider';
import type { PeticionLlm, ProveedorLlm, RespuestaLlm } from './llm/llm.types';

/**
 * Pruebas unitarias del arnés de reportes (tarea 3.1): el bucle de tool use, sus límites
 * y la bitácora, con un modelo "de guion" (respuestas fijas) en lugar de una API real.
 */

const r = (p: Partial<RespuestaLlm>): RespuestaLlm => ({
  texto: null, llamadas: [], modelo: 'guion', tokensEntrada: 10, tokensSalida: 5, ...p,
});
const llamada = (nombre: string, entrada: object = {}, id = 'c1') => ({ id, nombre, entrada: entrada as Record<string, unknown> });

/** Proveedor que responde en orden y guarda las peticiones que recibió. */
function guion(...respuestas: (RespuestaLlm | Error)[]) {
  const peticiones: PeticionLlm[] = [];
  const llm: ProveedorLlm = {
    nombre: 'guion',
    responder: async (p) => {
      peticiones.push(structuredClone(p));
      const sig = respuestas.shift() ?? r({ texto: 'fin' });
      if (sig instanceof Error) throw sig;
      return sig;
    },
  };
  return { llm, peticiones };
}

const filasSucursal = [
  { idSucursal: 1, sucursal: 'Centro', cantidadVentas: 3, unidadesVendidas: 5, totalVendido: 300 },
  { idSucursal: 2, sucursal: 'Norte', cantidadVentas: 1, unidadesVendidas: 1, totalVendido: 50.5 },
];

function armar(llm: ProveedorLlm, opciones: { branchIds?: number[] | null; recientes?: number; maxIter?: string } = {}) {
  const reports = {
    salesByBranch: jest.fn(async (_f: any, _s: any) => filasSucursal),
    topProducts: jest.fn(async () => []),
  };
  const categorias = { find: jest.fn(async () => [{ idCategoria: 9, nombre: 'Vestidos' }]) };
  const tools = new ReportToolsService(reports as any, categorias as any);
  const guardadas: any[] = [];
  const consultas = {
    count: jest.fn(async () => opciones.recientes ?? 0),
    create: (x: any) => x,
    save: jest.fn(async (x: any) => { guardadas.push(x); return { ...x, idConsultaIa: guardadas.length }; }),
  };
  const sucursales = { find: jest.fn(async () => [
    { idSucursal: 1, nombre: 'Centro', estado: true },
    { idSucursal: 2, nombre: 'Norte', estado: true },
  ]) };
  const empresas = { findOne: jest.fn(async () => ({ nombre: 'Bella Moda' })) };
  const access = { accessibleBranchIds: jest.fn(async () => (opciones.branchIds === undefined ? null : opciones.branchIds)) };
  const config = { get: (k: string) => ({ AI_REPORTS_MAX_ITER: opciones.maxIter ?? '4', APP_TIMEZONE: 'America/La_Paz' } as Record<string, string>)[k] };
  const service = new AiReportsService(llm, tools, access as any, consultas as any, sucursales as any, empresas as any, config as any);
  return { service, reports, guardadas };
}

const user = { idUsuario: 5, idEmpresa: 2, rol: 'ADMIN' };
const ask = (consulta: string, historial?: any[]) => ({ consulta, historial });

describe('AiReportsService (bucle de tool use)', () => {
  it('ejecuta la herramienta, devuelve tabla/gráfico del backend y la narrativa del modelo', async () => {
    const { llm, peticiones } = guion(
      r({ llamadas: [llamada('ventas_por_sucursal', { desde: '2026-10-01', hasta: '2026-10-31' })] }),
      r({ texto: 'Centro vendió Bs 300.' }),
    );
    const { service, guardadas } = armar(llm);
    const res = await service.consultar(user, ask('ventas por sucursal en octubre'));

    expect(res.tipo).toBe('reporte');
    expect(res.narrativa).toBe('Centro vendió Bs 300.');
    expect(res.reportes[0].resumen).toMatchObject({ totalVendido: 350.5, filas: 2 });
    expect(res.reportes[0].grafico).toEqual({ tipo: 'barras', x: 'sucursal', y: ['totalVendido'] });
    expect(res.meta).toMatchObject({ iteraciones: 2, tokensEntrada: 20, tokensSalida: 10 });
    // El segundo turno incluye el resultado de la herramienta (solo título, filtros, resumen y filas).
    const resultado = peticiones[1].mensajes.at(-1) as any;
    expect(resultado.rol).toBe('resultados');
    expect(JSON.parse(resultado.resultados[0].contenido)).toMatchObject({ titulo: 'Ventas por sucursal', filasOmitidas: 0 });
    expect(guardadas[0]).toMatchObject({ estado: 'OK', iteraciones: 2, herramientas: [{ nombre: 'ventas_por_sucursal', ok: true, filas: 2 }] });
  });

  it('las instrucciones llevan la fecha de hoy y solo las sucursales permitidas', async () => {
    const { llm, peticiones } = guion(r({ texto: 'ok' }));
    const { service } = armar(llm, { branchIds: [2] });
    await service.consultar(user, ask('hola'));
    expect(peticiones[0].sistema).toContain(`Hoy es ${hoyEn('America/La_Paz')}`);
    expect(peticiones[0].sistema).toContain('- 2: Norte');
    expect(peticiones[0].sistema).not.toContain('Centro');
    expect(peticiones[0].sistema).toContain('Bella Moda');
  });

  it('un error de validación vuelve al modelo, que corrige y termina', async () => {
    const { llm, peticiones } = guion(
      r({ llamadas: [llamada('ventas_por_sucursal', { desde: '2026-02-30' })] }),
      r({ llamadas: [llamada('ventas_por_sucursal', { desde: '2026-02-28' }, 'c2')] }),
      r({ texto: 'Listo.' }),
    );
    const { service, guardadas } = armar(llm);
    const res = await service.consultar(user, ask('ventas'));
    const error = (peticiones[1].mensajes.at(-1) as any).resultados[0];
    expect(error).toMatchObject({ esError: true });
    expect(error.contenido).toMatch(/inexistente/);
    expect(res.reportes).toHaveLength(1);
    expect(guardadas[0].herramientas.map((h: any) => h.ok)).toEqual([false, true]);
  });

  it('sucursal no asignada al usuario → rechazada aunque exista en la empresa', async () => {
    const { llm } = guion(r({ llamadas: [llamada('ventas_por_sucursal', {})] }), r({ texto: 'x' }));
    const { service, reports } = armar(llm, { branchIds: [1] });
    await service.consultar({ ...user, rol: 'ENCARGADO_SUCURSAL' }, ask('ventas'));
    expect((reports.salesByBranch.mock.calls[0][1] as any).branchIds).toEqual([1]);

    const g2 = guion(r({ llamadas: [llamada('top_productos', { idSucursal: 2 })] }), r({ texto: 'no' }));
    const res = await armar(g2.llm, { branchIds: [1] }).service.consultar(user, ask('top de Norte'));
    expect(res.tipo).toBe('sin_reporte');
    expect((g2.peticiones[1].mensajes.at(-1) as any).resultados[0].contenido).toMatch(/no está permitida/);
  });

  it('respeta el límite de iteraciones aunque el modelo siga pidiendo herramientas', async () => {
    const siempre = Array.from({ length: 10 }, (_, i) => r({ llamadas: [llamada('ventas_por_sucursal', {}, `c${i}`)] }));
    const { llm, peticiones } = guion(...siempre);
    const { service, guardadas } = armar(llm, { maxIter: '3' });
    const res = await service.consultar(user, ask('ventas'));
    expect(peticiones).toHaveLength(3);
    expect(res.reportes.length).toBeLessThanOrEqual(4);
    expect(res.narrativa).toMatch(/^Generé/); // narrativa de respaldo del backend
    expect(guardadas[0].iteraciones).toBe(3);
  });

  it('como máximo 3 herramientas por turno', async () => {
    const muchas = [1, 2, 3, 4].map((i) => llamada('ventas_por_sucursal', {}, `c${i}`));
    const { llm, peticiones } = guion(r({ llamadas: muchas }), r({ texto: 'ok' }));
    const res = await armar(llm).service.consultar(user, ask('todo'));
    expect(res.reportes).toHaveLength(3);
    expect((peticiones[1].mensajes.at(-1) as any).resultados[3]).toMatchObject({ esError: true });
  });

  it('pedir_aclaracion corta el bucle y no devuelve datos', async () => {
    const { llm, peticiones } = guion(r({ llamadas: [llamada('pedir_aclaracion', { pregunta: '¿De qué mes?' })] }));
    const { service, guardadas } = armar(llm);
    const res = await service.consultar(user, ask('ventas del mes'));
    expect(res).toMatchObject({ tipo: 'aclaracion', aclaracion: '¿De qué mes?', narrativa: null, reportes: [] });
    expect(peticiones).toHaveLength(1);
    expect(guardadas[0].estado).toBe('ACLARACION');
  });

  it('respuesta sin herramientas (pregunta fuera de tema) → sin_reporte con el texto del modelo', async () => {
    const { llm } = guion(r({ texto: 'Solo genero reportes del negocio.' }));
    const res = await armar(llm).service.consultar(user, ask('¿quién ganó el partido?'));
    expect(res).toMatchObject({ tipo: 'sin_reporte', narrativa: 'Solo genero reportes del negocio.' });
  });

  it('si el proveedor falla → 503 y queda registrado como ERROR', async () => {
    const { llm } = guion(new Error('credit balance too low'));
    const { service, guardadas } = armar(llm);
    await expect(service.consultar(user, ask('ventas'))).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(guardadas[0]).toMatchObject({ estado: 'ERROR', error: 'credit balance too low' });
  });

  it('límite de consultas por minuto → 429 sin llamar al modelo', async () => {
    const { llm, peticiones } = guion();
    const { service } = armar(llm, { recientes: 10 });
    const e = await service.consultar(user, ask('ventas')).catch((x) => x);
    expect(e).toBeInstanceOf(HttpException);
    expect((e as HttpException).getStatus()).toBe(429);
    expect(peticiones).toHaveLength(0);
  });

  it('el historial se envía alternado y empieza por el usuario', async () => {
    const { llm, peticiones } = guion(r({ texto: 'ok' }));
    await armar(llm).service.consultar(user, ask('de octubre', [
      { rol: 'asistente', texto: 'Hola' },
      { rol: 'usuario', texto: 'ventas por sucursal' },
      { rol: 'asistente', texto: '¿De qué mes?' },
    ]));
    expect(peticiones[0].mensajes.map((m) => m.rol)).toEqual(['usuario', 'asistente', 'usuario']);
  });
});

describe('AnthropicProveedor (adaptador)', () => {
  it('convierte herramientas, tool_use y tool_result al formato de Anthropic', async () => {
    const create = jest.fn(async (_p: any) => ({
      model: 'claude-haiku-4-5',
      usage: { input_tokens: 120, output_tokens: 30 },
      content: [
        { type: 'text', text: 'Reviso las ventas.' },
        { type: 'tool_use', id: 'tu_1', name: 'ventas_por_sucursal', input: { desde: '2026-10-01' } },
      ],
    }));
    const p = new AnthropicProveedor('clave', 'claude-haiku-4-5', { create } as any);
    const res = await p.responder({
      sistema: 'S',
      maxTokens: 500,
      herramientas: [{ nombre: 'ventas_por_sucursal', descripcion: 'd', parametros: { type: 'object', properties: {} } }],
      mensajes: [
        { rol: 'usuario', texto: 'hola' },
        { rol: 'asistente', texto: null, llamadas: [llamada('top_productos', { limite: 3 }, 'tu_0')] },
        { rol: 'resultados', resultados: [{ id: 'tu_0', contenido: '{"ok":1}', esError: false }] },
      ],
    });
    const enviado = create.mock.calls[0][0];
    expect(enviado).toMatchObject({ model: 'claude-haiku-4-5', max_tokens: 500, system: 'S' });
    expect(enviado.tools[0]).toEqual({ name: 'ventas_por_sucursal', description: 'd', input_schema: { type: 'object', properties: {} } });
    expect(enviado.messages[1]).toEqual({ role: 'assistant', content: [{ type: 'tool_use', id: 'tu_0', name: 'top_productos', input: { limite: 3 } }] });
    expect(enviado.messages[2]).toEqual({ role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_0', content: '{"ok":1}', is_error: false }] });
    expect(res).toEqual({
      texto: 'Reviso las ventas.',
      llamadas: [{ id: 'tu_1', nombre: 'ventas_por_sucursal', entrada: { desde: '2026-10-01' } }],
      modelo: 'claude-haiku-4-5',
      tokensEntrada: 120,
      tokensSalida: 30,
    });
  });
});

describe('SimuladoProveedor (reglas)', () => {
  const sim = new SimuladoProveedor(() => '2026-11-06');
  const pedir = async (texto: string) =>
    (await sim.responder({ sistema: '', maxTokens: 1, herramientas: [], mensajes: [{ rol: 'usuario', texto }] })).llamadas[0];

  it.each([
    ['ventas de ayer', 'ventas_por_periodo', { desde: '2026-11-05', hasta: '2026-11-05', agrupar: 'dia' }],
    ['ventas por mes de este año', 'ventas_por_periodo', { desde: '2026-01-01', hasta: '2026-11-06', agrupar: 'mes' }],
    ['top 3 productos del mes pasado', 'top_productos', { desde: '2026-10-01', hasta: '2026-10-31', limite: 3 }],
    ['stock bajo menos de 2', 'stock_bajo', { umbral: 2 }],
    ['reservas de los últimos 7 días', 'reservas_por_estado', { desde: '2026-10-31', hasta: '2026-11-06' }],
    ['cobros con QR esta semana', 'ventas_por_metodo_pago', { desde: '2026-11-02', hasta: '2026-11-06' }],
    ['prendas más devueltas y cambiadas del mes pasado', 'devoluciones_y_cambios_por_producto', { desde: '2026-10-01', hasta: '2026-10-31' }],
    ['¿por qué cambian las prendas?', 'motivos_devolucion_y_cambio', { tipo: 'cambios' }],
    ['motivos de devolución este año', 'motivos_devolucion_y_cambio', { tipo: 'devoluciones', desde: '2026-01-01' }],
    ['¿qué tal?', 'pedir_aclaracion', {}],
  ])('"%s" → %s', async (texto, nombre, entrada) => {
    const l = await pedir(texto);
    expect(l.nombre).toBe(nombre);
    expect(l.entrada).toMatchObject(entrada);
  });
});
