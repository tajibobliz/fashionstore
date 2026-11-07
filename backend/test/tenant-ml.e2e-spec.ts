/**
 * Pruebas E2E de la analítica con ML (Fase 3, tarea 3.3): backend NestJS + ml-service real.
 *
 * - Solo el plan Empresarial (`features.ml`) y los roles ADMIN/ENCARGADO.
 * - La empresa la pone el backend (JWT): cada empresa entrena y consulta SU modelo.
 * - Si el ml-service no responde → 503 con un mensaje claro.
 *
 * Urban Step pasa temporalmente a Empresarial y al final vuelve a su plan y vencimiento.
 * Requisitos: los de tenant-isolation + `ml-service/.venv` (ver ml-service/README.md).
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
import { mlDisponible, startMlService, MlService } from './support/ml';

const CLAVE = 'clave-ml-e2e';
let backend: Backend;
let caido: Backend;
let ml: MlService | null;
let c: ReturnType<typeof client>;
let cCaido: ReturnType<typeof client>;
let idB: number;
let original: { plan: string; vence: string };
let sucursalesA: number[];
let sucursalesB: number[];

const conMl = () => (mlDisponible ? it : it.skip);

beforeAll(async () => {
  await assertRlsApplies();
  ml = await startMlService(CLAVE);
  if (!ml) console.warn('⚠ ml-service/.venv no existe: se omiten las pruebas que entrenan modelos.');
  process.env.ML_API_KEY = CLAVE;
  process.env.ML_SERVICE_URL = ml?.url ?? 'http://127.0.0.1:9';
  backend = await startBackend();
  process.env.ML_SERVICE_URL = 'http://127.0.0.1:9'; // puerto sin servicio
  caido = await startBackend();

  c = client(backend.base);
  cCaido = client(caido.base);
  await c.login('ROOT', { email: ROOT_EMAIL, password: ROOT_PASSWORD });
  await c.login('A', { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
  for (const [who, email] of [
    ['B', 'admin@urbanstep.demo'],
    ['ENC', 'encargado@urbanstep.demo'],
    ['ENCS', 'encargado.centro@urbanstep.demo'],
    ['CAJ', 'cajero@urbanstep.demo'],
  ])
    await c.login(who, { email, password: DEMO_PASSWORD, empresa: DEMO_SLUG });
  await cCaido.login('B', { email: 'admin@urbanstep.demo', password: DEMO_PASSWORD, empresa: DEMO_SLUG });
  idB = c.tid('B');
  const det = (await c.api('GET', `/platform/empresas/${idB}`, { who: 'ROOT' })).body;
  original = { plan: det.plan.codigo, vence: det.suscripcion.fechaVencimiento };
  sucursalesA = (await c.api('GET', '/branches/sucursales', { who: 'A' })).body.map((s: any) => s.idSucursal);
  sucursalesB = (await c.api('GET', '/branches/sucursales', { who: 'B' })).body.map((s: any) => s.idSucursal);
}, 90_000);

afterAll(async () => {
  if (idB && original) {
    await c.api('POST', `/platform/empresas/${idB}/suscripcion`, { who: 'ROOT', body: { codigoPlan: original.plan } });
    await c.api('PATCH', `/platform/empresas/${idB}/suscripcion/vencimiento`, {
      who: 'ROOT',
      body: { fechaVencimiento: original.vence },
    });
  }
  backend?.stop();
  caido?.stop();
  ml?.stop();
});

const plan = (codigoPlan: string) =>
  c.api('POST', `/platform/empresas/${idB}/suscripcion`, { who: 'ROOT', body: { codigoPlan } });

describe('Analítica ML: plan y roles', () => {
  it('Básico y Profesional no incluyen ML (403); Empresarial sí', async () => {
    for (const p of ['BASICO', 'PROFESIONAL']) {
      await plan(p);
      const r = await c.api('GET', '/ml/metricas', { who: 'B' });
      expect(r.status).toBe(403);
      expect(r.body.code).toBe('PLAN_SIN_FUNCIONALIDAD');
    }
    await plan('EMPRESARIAL');
    expect([200, 404, 503]).toContain((await c.api('GET', '/ml/metricas', { who: 'B' })).status);
  });

  it('cajero y encargado de sucursal no tienen acceso', async () => {
    expect((await c.api('GET', '/ml/segmentos', { who: 'CAJ' })).status).toBe(403);
    expect((await c.api('POST', '/ml/entrenar', { who: 'ENCS' })).status).toBe(403);
  });

  it('si el ml-service no responde → 503 con mensaje claro', async () => {
    const r = await cCaido.api('POST', '/ml/entrenar', { who: 'B' });
    expect(r.status).toBe(503);
    expect(r.body.message).toMatch(/no está disponible/);
  });

  it('valida los parámetros del pronóstico', async () => {
    expect((await c.api('GET', '/ml/demanda?semanas=50', { who: 'B' })).status).toBe(400);
    expect((await c.api('GET', '/ml/demanda?idSucursal=abc', { who: 'B' })).status).toBe(400);
  });
});

describe('Analítica ML: entrenamiento y consultas (con ml-service)', () => {
  conMl()('antes de entrenar → 404 con indicación', async () => {
    const r = await c.api('GET', '/ml/segmentos', { who: 'B' });
    expect(r.status).toBe(404);
    expect(r.body.message).toMatch(/Entrenar/);
  });

  conMl()('entrena con el catálogo y las ventas reales de la empresa + datos sintéticos', async () => {
    const r = await c.api('POST', '/ml/entrenar', { who: 'B' });
    expect(r.status).toBe(200);
    expect(r.body.meta.idEmpresa).toBe(idB);
    const productos = (await c.api('GET', '/catalog/productos', { who: 'B' })).body;
    const activos = (Array.isArray(productos) ? productos : productos.items ?? []).filter((p: any) => p.estado !== false);
    expect(r.body.meta.datos.series).toBe(activos.length * sucursalesB.length);
    expect(r.body.meta.datos.filasReales).toBeGreaterThan(0); // Urban Step tiene ventas reales
    expect(r.body.demanda.modelo.mae).toBeLessThan(r.body.demanda.lineaBase.mae);
    expect(r.body.segmentacion.silhouette).toBeGreaterThan(0.2);
  }, 120_000);

  conMl()('pronóstico de demanda: serie con historia y predicción + ranking de productos', async () => {
    const r = await c.api('GET', '/ml/demanda?semanas=4&top=3', { who: 'ENC' });
    expect(r.status).toBe(200);
    expect(r.body.serie.filter((x: any) => 'prediccion' in x)).toHaveLength(4);
    expect(r.body.serie.filter((x: any) => 'historia' in x).length).toBeGreaterThan(0);
    expect(r.body.productos).toHaveLength(3);
    const suc = await c.api('GET', `/ml/demanda?idSucursal=${sucursalesB[0]}`, { who: 'B' });
    expect(suc.status).toBe(200);
    expect(suc.body.sucursal).toBeTruthy();
  });

  conMl()('una sucursal de otra empresa no se puede consultar', async () => {
    const ajena = sucursalesA.find((id) => !sucursalesB.includes(id))!;
    const r = await c.api('GET', `/ml/demanda?idSucursal=${ajena}`, { who: 'B' });
    expect(r.status).toBe(400);
  });

  conMl()('segmentos con nombre, acción y clientas reales de la empresa', async () => {
    const r = await c.api('GET', '/ml/segmentos', { who: 'B' });
    expect(r.status).toBe(200);
    expect(r.body.segmentos.length).toBe(r.body.metricas.k);
    expect(r.body.segmentos.every((s: any) => s.nombre && s.accion)).toBe(true);
    for (const cli of r.body.clientesReales) expect(cli.idCliente).toBeGreaterThan(0);
    const m = await c.api('GET', '/ml/metricas', { who: 'B' });
    expect(m.body.demanda.importancia.length).toBeGreaterThan(5);
  });
});
