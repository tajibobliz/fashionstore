/**
 * Pruebas E2E de reportes generativos con IA (Fase 3, tarea 3.1) contra una BD real.
 *
 * Se usa el proveedor SIMULADO (LLM_PROVIDER=simulado): reproduce las "tool calls" de un
 * modelo sin internet ni costo, así que se prueba todo el arnés real: validación de
 * parámetros, alcance de empresa y sucursal, plan, roles, bitácora y que las cifras del
 * reporte sean las mismas que las de /reports.
 *
 * Urban Step (Empresa B) está en plan Básico: la prueba lo pasa a Profesional y al final
 * lo devuelve a Básico con su fecha de vencimiento original.
 *
 * Requisitos: los mismos que tenant-isolation. Ejecutar: npm run test:e2e:tenant
 */
import {
  DEMO_PASSWORD,
  DEMO_SLUG,
  ROOT_EMAIL,
  ROOT_PASSWORD,
  assertRlsApplies,
  client,
  startBackend,
  Backend,
} from './support/backend';

let backend: Backend;
let c: ReturnType<typeof client>;
let idB: number;
let vencimientoOriginal: string;
let sucursalesB: { idSucursal: number; nombre: string }[];
const hoy = new Intl.DateTimeFormat('en-CA', {
  timeZone: process.env.APP_TIMEZONE || 'America/La_Paz',
}).format(new Date());
const RANGO = { desde: '2025-01-01', hasta: hoy };

const preguntar = (who: string, consulta: string, extra: object = {}) =>
  c.api('POST', '/ai/reports/query', { who, body: { consulta, ...extra } });
/** Orden directa al proveedor simulado: misma herramienta y parámetros que pediría un modelo. */
const herramienta = (who: string, nombre: string, params: object = {}) =>
  preguntar(who, `#${nombre} ${JSON.stringify(params)}`);
const plan = (codigoPlan: string) =>
  c.api('POST', `/platform/empresas/${idB}/suscripcion`, {
    who: 'ROOT',
    body: { codigoPlan },
  });

beforeAll(async () => {
  await assertRlsApplies();
  process.env.LLM_PROVIDER = 'simulado';
  process.env.AI_REPORTS_POR_MINUTO = '200';
  backend = await startBackend();
  c = client(backend.base);
  await c.login('ROOT', { email: ROOT_EMAIL, password: ROOT_PASSWORD });
  await c.login('A', {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });
  for (const [who, email] of [
    ['B', 'admin@urbanstep.demo'],
    ['ENC', 'encargado.centro@urbanstep.demo'],
    ['CAJ', 'cajero@urbanstep.demo'],
  ])
    await c.login(who, { email, password: DEMO_PASSWORD, empresa: DEMO_SLUG });
  idB = c.tid('B');
  const det = await c.api('GET', `/platform/empresas/${idB}`, { who: 'ROOT' });
  vencimientoOriginal = det.body.suscripcion.fechaVencimiento;
  sucursalesB = (await c.api('GET', '/branches/sucursales', { who: 'B' })).body.map(
    (s: any) => ({ idSucursal: s.idSucursal, nombre: s.nombre }),
  );
}, 60_000);

afterAll(async () => {
  if (idB && vencimientoOriginal) {
    await plan('BASICO');
    await c.api('PATCH', `/platform/empresas/${idB}/suscripcion/vencimiento`, {
      who: 'ROOT',
      body: { fechaVencimiento: vencimientoOriginal },
    });
  }
  backend?.stop();
});

describe('Reportes con IA: plan y roles', () => {
  it('el plan Básico no incluye reportes con IA (403)', async () => {
    expect((await plan('BASICO')).status).toBe(201);
    const r = await preguntar('B', 'ventas de este mes');
    expect(r.status).toBe(403);
    expect((await plan('PROFESIONAL')).status).toBe(201);
    expect((await preguntar('B', 'ventas de este mes')).status).toBe(200);
  });

  it('el cajero no puede usar reportes con IA', async () => {
    expect((await preguntar('CAJ', 'ventas de hoy')).status).toBe(403);
  });

  it('valida la petición (pregunta vacía, historial demasiado largo)', async () => {
    expect((await preguntar('B', 'a')).status).toBe(400);
    const historial = Array.from({ length: 7 }, () => ({ rol: 'usuario', texto: 'hola' }));
    expect((await preguntar('B', 'ventas', { historial })).status).toBe(400);
  });
});

describe('Reportes con IA: tipos de reporte con datos reales', () => {
  it.each([
    ['ventas de este año por mes', 'ventas_por_periodo', 'linea'],
    ['ventas por sucursal este año', 'ventas_por_sucursal', 'barras'],
    ['top 5 productos más vendidos este año', 'top_productos', 'barras'],
    ['ingresos por categoría este año', 'ingresos_por_categoria', 'torta'],
    ['qué productos tienen stock bajo', 'stock_bajo', null],
    ['reservas por estado este año', 'reservas_por_estado', 'torta'],
    ['cobros por método de pago este año', 'ventas_por_metodo_pago', 'torta'],
  ])('"%s" → %s', async (consulta, nombre, grafico) => {
    const r = await preguntar('B', consulta);
    expect(r.status).toBe(200);
    expect(r.body.tipo).toBe('reporte');
    const [rep] = r.body.reportes;
    expect(rep.herramienta).toBe(nombre);
    expect(rep.columnas.length).toBeGreaterThan(1);
    expect(rep.filas.length).toBeGreaterThan(0);
    for (const fila of rep.filas)
      for (const col of rep.columnas) expect(col.clave in fila).toBe(true);
    expect(rep.grafico?.tipo ?? null).toBe(grafico);
    expect(typeof r.body.narrativa).toBe('string');
    expect(r.body.meta.proveedor).toBe('simulado');
  });

  it('las cifras son las mismas que las de /reports (la IA no las calcula)', async () => {
    const ia = await herramienta('B', 'ventas_por_sucursal', RANGO);
    const ref = await c.api(
      'GET',
      `/reports/sales/by-branch?desde=${RANGO.desde}&hasta=${RANGO.hasta}`,
      { who: 'B' },
    );
    const total = (xs: any[]) => xs.reduce((s, x) => s + Number(x.totalVendido), 0);
    expect(ia.body.reportes[0].filas.length).toBe(ref.body.length);
    expect(ia.body.reportes[0].resumen.totalVendido).toBeCloseTo(total(ref.body), 2);

    const top = await herramienta('B', 'top_productos', { ...RANGO, limite: 5 });
    const refTop = await c.api(
      'GET',
      `/reports/products/top?desde=${RANGO.desde}&hasta=${RANGO.hasta}`,
      { who: 'B' },
    );
    expect(top.body.reportes[0].filas.map((x: any) => x.producto)).toEqual(
      refTop.body.slice(0, 5).map((x: any) => x.nombre),
    );
  });

  it('agrupar por mes suma lo mismo que agrupar por día', async () => {
    const dia = await herramienta('B', 'ventas_por_periodo', { ...RANGO, agrupar: 'dia' });
    const mes = await herramienta('B', 'ventas_por_periodo', { ...RANGO, agrupar: 'mes' });
    expect(mes.body.reportes[0].resumen.totalVendido).toBeCloseTo(
      dia.body.reportes[0].resumen.totalVendido,
      2,
    );
    expect(mes.body.reportes[0].filas.length).toBeLessThanOrEqual(dia.body.reportes[0].filas.length);
  });

  it('filtra por nombre de categoría y avisa si no existe', async () => {
    const cats = (await c.api('GET', '/catalog/categorias', { who: 'B' })).body;
    const nombre = cats[0].nombre;
    const ok = await herramienta('B', 'top_productos', { ...RANGO, categoria: nombre.toUpperCase() });
    expect(ok.body.reportes[0].filtros['Categoría']).toBe(nombre);
    for (const f of ok.body.reportes[0].filas) expect(f.categoria).toBe(nombre);
    const no = await herramienta('B', 'top_productos', { categoria: 'Trajes de astronauta' });
    expect(no.body.tipo).toBe('sin_reporte');
    expect(no.body.narrativa).toMatch(/No existe la categoría/);
  });
});

describe('Reportes con IA: consultas no permitidas', () => {
  it('pregunta ambigua → pide aclaración y no devuelve datos', async () => {
    const r = await preguntar('B', 'hola, ¿cómo estás?');
    expect(r.body.tipo).toBe('aclaracion');
    expect(r.body.aclaracion).toBeTruthy();
    expect(r.body.reportes).toEqual([]);
  });

  it.each([
    ['herramienta inexistente', 'borrar_ventas', {}, /no existe/],
    ['parámetro extra (SQL)', 'top_productos', { sql: 'DROP TABLE venta' }, /no permitidos: sql/],
    ['tipo inválido', 'top_productos', { limite: 'muchos' }, /inválidos/],
    ['límite fuera de rango', 'top_productos', { limite: 500 }, /inválidos/],
    ['fecha inexistente', 'ventas_por_sucursal', { desde: '2026-02-30' }, /inexistente/],
    ['rango invertido', 'ventas_por_sucursal', { desde: '2026-05-01', hasta: '2026-04-01' }, /posterior/],
    ['rango de más de 2 años', 'ventas_por_sucursal', { desde: '2020-01-01', hasta: '2026-01-01' }, /rango máximo/],
    ['valor fuera de la lista', 'ventas_por_periodo', { agrupar: 'hora' }, /inválidos/],
  ])('%s → se rechaza sin datos', async (_caso, nombre, params, mensaje) => {
    const r = await herramienta('B', nombre, params);
    expect(r.status).toBe(200);
    expect(r.body.tipo).toBe('sin_reporte');
    expect(r.body.reportes).toEqual([]);
    expect(r.body.narrativa).toMatch(mensaje);
  });

  it('la bitácora registra la herramienta rechazada y sus parámetros', async () => {
    await herramienta('B', 'top_productos', { sql: 'DROP TABLE venta' });
    const h = await c.api('GET', '/ai/reports/historial', { who: 'B' });
    expect(h.status).toBe(200);
    expect(h.body[0].estado).toBe('SIN_REPORTE');
    expect(h.body[0].herramientas).toEqual(['top_productos']);
  });
});

describe('Reportes con IA: alcance por sucursal y por empresa', () => {
  it('el encargado de sucursal solo ve su sucursal', async () => {
    const r = await herramienta('ENC', 'ventas_por_sucursal', RANGO);
    expect(r.status).toBe(200);
    const nombres = r.body.reportes[0].filas.map((x: any) => x.sucursal);
    expect(nombres.length).toBeGreaterThan(0);
    expect(new Set(nombres)).toEqual(new Set(['Urban Step Centro']));
    const ref = await c.api(
      'GET',
      `/reports/sales/by-branch?desde=${RANGO.desde}&hasta=${RANGO.hasta}`,
      { who: 'ENC' },
    );
    expect(r.body.reportes[0].resumen.totalVendido).toBeCloseTo(
      ref.body.reduce((s: number, x: any) => s + Number(x.totalVendido), 0),
      2,
    );
  });

  it('el encargado no puede pedir otra sucursal de su empresa', async () => {
    const otra = sucursalesB.find((s) => s.nombre !== 'Urban Step Centro')!;
    const r = await herramienta('ENC', 'top_productos', { idSucursal: otra.idSucursal });
    expect(r.body.tipo).toBe('sin_reporte');
    expect(r.body.narrativa).toMatch(/no está permitida/);
  });

  it('la Empresa A no puede pedir sucursales de la Empresa B', async () => {
    const r = await herramienta('A', 'top_productos', { idSucursal: sucursalesB[0].idSucursal });
    if (r.status === 403) return; // Empresa A sin IA en su plan: tampoco ve datos
    expect(r.body.tipo).toBe('sin_reporte');
    expect(r.body.narrativa).toMatch(/no está permitida/);
    expect(r.body.narrativa).not.toMatch(/Urban Step/);
  });

  it('cada empresa ve solo su bitácora; el encargado solo la suya', async () => {
    const hB = (await c.api('GET', '/ai/reports/historial', { who: 'B' })).body;
    const hEnc = (await c.api('GET', '/ai/reports/historial', { who: 'ENC' })).body;
    expect(hB.some((x: any) => x.usuario?.startsWith('Encargado'))).toBe(true);
    expect(hEnc.every((x: any) => x.usuario?.startsWith('Encargado'))).toBe(true);
    const hA = await c.api('GET', '/ai/reports/historial', { who: 'A' });
    if (hA.status === 200) {
      const idsB = new Set(hB.map((x: any) => x.idConsulta));
      expect(hA.body.some((x: any) => idsB.has(x.idConsulta))).toBe(false);
    }
  });
});
