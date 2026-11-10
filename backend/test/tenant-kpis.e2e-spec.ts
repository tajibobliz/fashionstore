/**
 * Pruebas E2E del dashboard de KPIs (CU12, Fase 3 tarea 3.4) contra una BD real:
 * alcance por rol y sucursal, aislamiento entre empresas, cifras coherentes con /reports.
 * Requisitos: los de tenant-isolation. Ejecutar: npm run test:e2e:tenant
 */
import { DEMO_PASSWORD, DEMO_SLUG, assertRlsApplies, client, startBackend, Backend } from './support/backend';

let backend: Backend;
let c: ReturnType<typeof client>;
let centro: { idSucursal: number; nombre: string };
let otra: { idSucursal: number; nombre: string };
const zona = process.env.APP_TIMEZONE || 'America/La_Paz';
const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: zona }).format(new Date());
const kpis = (who: string, qs = '') => c.api('GET', `/reports/kpis${qs}`, { who });

beforeAll(async () => {
  await assertRlsApplies();
  backend = await startBackend();
  c = client(backend.base);
  await c.login('A', { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
  for (const [who, email] of [
    ['B', 'admin@urbanstep.demo'],
    ['ENCS', 'encargado.centro@urbanstep.demo'],
    ['CAJ', 'cajero@urbanstep.demo'],
  ])
    await c.login(who, { email, password: DEMO_PASSWORD, empresa: DEMO_SLUG });
  const sucs = (await c.api('GET', '/branches/sucursales', { who: 'B' })).body;
  centro = sucs.find((s: any) => s.nombre === 'Urban Step Centro');
  otra = sucs.find((s: any) => s.nombre !== 'Urban Step Centro');
}, 60_000);

afterAll(() => backend?.stop());

describe('KPIs (CU12)', () => {
  it('el administrador ve los KPIs de toda su empresa', async () => {
    const r = await kpis('B');
    expect(r.status).toBe(200);
    const d = r.body;
    expect(d.hoy).toBe(hoy);
    expect(d.sucursal).toBeNull();
    expect(d.sucursales.map((s: any) => s.nombre).sort()).toEqual([centro.nombre, otra.nombre].sort());
    for (const k of ['ventasHoy', 'ventasMes', 'stockCritico', 'devoluciones', 'cambios'])
      expect(d[k]).toBeDefined();
    expect(typeof d.reservasPendientes).toBe('number');
    expect(typeof d.conflictosAbiertos).toBe('number');
    expect(d.tendencia).toHaveLength(30);
    expect(d.tendencia.at(-1).fecha).toBe(hoy);
    expect(d.topCambiadas.length).toBeLessThanOrEqual(5);
    // como máximo 3 prendas por sucursal
    const porSucursal = new Map<number, number>();
    for (const t of d.topPorSucursal) porSucursal.set(t.idSucursal, (porSucursal.get(t.idSucursal) ?? 0) + 1);
    for (const n of porSucursal.values()) expect(n).toBeLessThanOrEqual(3);
  });

  it('la tendencia de 365 días suma lo mismo que /reports en ese rango', async () => {
    const d = (await kpis('B', '?dias=365')).body;
    const desde = d.tendencia[0].fecha;
    const ref = (await c.api('GET', `/reports/sales/by-branch?desde=${desde}&hasta=${hoy}`, { who: 'B' })).body;
    const suma = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;
    expect(suma(d.tendencia.map((x: any) => x.monto))).toBeCloseTo(suma(ref.map((x: any) => Number(x.totalVendido))), 1);
  });

  it('la tasa de devoluciones y de cambios es coherente', async () => {
    const d = (await kpis('B', '?dias=365')).body;
    const { unidadesDevueltas, unidadesVendidas, tasa } = d.devoluciones;
    expect(unidadesDevueltas).toBeLessThanOrEqual(unidadesVendidas);
    if (unidadesVendidas) expect(tasa).toBeCloseTo((100 * unidadesDevueltas) / unidadesVendidas, 1);
    const sumaTop = d.topCambiadas.reduce((s: number, x: any) => s + x.unidades, 0);
    expect(sumaTop).toBeLessThanOrEqual(d.cambios.unidadesCambiadas);
  });

  it('el encargado de sucursal solo ve su sucursal', async () => {
    const r = await kpis('ENCS', '?dias=365');
    expect(r.status).toBe(200);
    expect(r.body.sucursales).toEqual([{ idSucursal: centro.idSucursal, nombre: centro.nombre }]);
    expect(r.body.topPorSucursal.every((t: any) => t.idSucursal === centro.idSucursal)).toBe(true);
    // Mismo resultado que el administrador filtrando por esa sucursal
    const adm = (await kpis('B', `?dias=365&idSucursal=${centro.idSucursal}`)).body;
    expect(adm.sucursal).toBe(centro.nombre);
    expect(r.body.ventasMes).toEqual(adm.ventasMes);
    expect(r.body.stockCritico).toEqual(adm.stockCritico);
    // ...y no puede pedir otra sucursal
    expect((await kpis('ENCS', `?idSucursal=${otra.idSucursal}`)).status).toBe(403);
  });

  it('una empresa no puede pedir KPIs de una sucursal de otra empresa', async () => {
    expect((await kpis('A', `?idSucursal=${centro.idSucursal}`)).status).toBe(403);
    const a = (await kpis('A')).body;
    expect(a.sucursales.some((s: any) => s.idSucursal === centro.idSucursal)).toBe(false);
  });

  it('roles y validación', async () => {
    expect((await kpis('CAJ')).status).toBe(403);
    expect((await kpis('B', '?dias=3')).status).toBe(400);
    expect((await kpis('B', '?idSucursal=abc')).status).toBe(400);
  });
});
