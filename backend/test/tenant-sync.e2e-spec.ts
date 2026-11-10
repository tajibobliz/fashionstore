/**
 * Pruebas E2E de la sincronización offline (Fase 2, §6 del plan) contra una BD real.
 *
 * Escenario principal (§6.4.1): la última unidad de una prenda se vende/reserva en dos
 * dispositivos sin internet. Gana la primera operación que llega al servidor:
 *   - venta presencial que llega segunda → se registra igual con CONFLICTO de STOCK;
 *   - reserva que llega segunda → no se crea, CONFLICTO SIN_STOCK con alternativas.
 * Además: idempotencia (reintentos), precios, rechazos, aislamiento y panel del encargado.
 *
 * Requisitos: los mismos que tenant-isolation (migraciones, seed:demo, DB_USER sin superusuario).
 * Ejecutar:  npm run test:e2e:tenant
 */
import { randomUUID } from 'node:crypto';
import {
  DEMO_PASSWORD,
  DEMO_SLUG,
  assertRlsApplies,
  client,
  startBackend,
  Backend,
} from './support/backend';

let backend: Backend;
let c: ReturnType<typeof client>;

/** Datos de la Empresa B usados en las pruebas. */
let idSucursal: number;
let otraSucursal: number;
let idInventario: number;
let idVariante: number;
let precioFinal: number;
let serverTime: string;
let idTurno: number;
let varianteDeA: number;

const ponerStock = (stock: number) =>
  c.api('PATCH', `/inventory/inventarios/${idInventario}`, {
    who: 'B',
    body: { stockDisponible: stock },
  });
const stockActual = async () =>
  (
    await c.api('GET', `/sync/catalog?sucursal=${idSucursal}`, { who: 'B' })
  ).body.productos
    .flatMap((p: any) => p.variantes)
    .find((v: any) => v.idVariante === idVariante).stockDisponible;

const venta = (
  over: {
    operationId?: string;
    precio?: number;
    descargado?: string;
    variante?: number;
  } = {},
) => ({
  operationId: over.operationId ?? randomUUID(),
  type: 'VENTA',
  idSucursal,
  createdAtLocal: new Date().toISOString(),
  payload: {
    idTurno,
    catalogoDescargadoEn: over.descargado ?? serverTime,
    detalles: [
      {
        idVariante: over.variante ?? idVariante,
        cantidad: 1,
        precioUnitario: over.precio ?? precioFinal,
      },
    ],
  },
});
const reserva = () => ({
  operationId: randomUUID(),
  type: 'RESERVA',
  idSucursal,
  createdAtLocal: new Date().toISOString(),
  payload: { detalles: [{ idVariante, cantidad: 1 }] },
});
const sync = async (who: string, ...operations: object[]) => {
  const r = await c.api('POST', '/sync/operations', {
    who,
    body: { deviceId: `e2e-${who}`, operations },
  });
  expect(r.status).toBe(200);
  return r.body.results as any[];
};

beforeAll(async () => {
  await assertRlsApplies();
  backend = await startBackend();
  c = client(backend.base);
  await c.login('A', {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });
  await c.login('B', {
    email: 'admin@urbanstep.demo',
    password: DEMO_PASSWORD,
    empresa: DEMO_SLUG,
  });
  await c.login('CLI', {
    email: 'cliente@urbanstep.demo',
    password: DEMO_PASSWORD,
    empresa: DEMO_SLUG,
  });

  // Una prenda del almacén principal que también exista en otra sucursal (para las alternativas).
  const inventarios = (
    await c.api('GET', '/inventory/inventarios', { who: 'B' })
  ).body.filter((i: any) => i.almacen?.codigo === 'PRINCIPAL');
  const fila = inventarios.find((i: any) =>
    inventarios.some(
      (o: any) =>
        o.variante.idVariante === i.variante.idVariante &&
        o.sucursal.idSucursal !== i.sucursal.idSucursal,
    ),
  );
  idInventario = fila.idInventario;
  idVariante = fila.variante.idVariante;
  idSucursal = fila.sucursal.idSucursal;
  const otra = inventarios.find(
    (o: any) =>
      o.variante.idVariante === idVariante &&
      o.sucursal.idSucursal !== idSucursal,
  );
  otraSucursal = otra.sucursal.idSucursal;
  await c.api('PATCH', `/inventory/inventarios/${otra.idInventario}`, {
    who: 'B',
    body: { stockDisponible: 4 },
  });

  // Caja y turno propios de la prueba (no interfieren con el cajero de la demo).
  const cajas = (
    await c.api('GET', `/pos/cajas/sucursal/${idSucursal}`, { who: 'B' })
  ).body;
  let caja = cajas.find((x: any) => x.codigo === 'E2E-SYNC');
  if (!caja) {
    caja = (
      await c.api('POST', '/pos/cajas', {
        who: 'B',
        body: {
          idSucursal,
          codigo: 'E2E-SYNC',
          nombre: 'Caja E2E sincronización',
        },
      })
    ).body;
  }
  let turno = await c.api('GET', `/pos/turnos/actual?idCaja=${caja.idCaja}`, {
    who: 'B',
  });
  if (turno.status !== 200) {
    turno = await c.api('POST', '/pos/turnos/abrir', {
      who: 'B',
      body: { idCaja: caja.idCaja, montoApertura: 0 },
    });
  }
  idTurno = turno.body.idTurno;

  // Una variante de la Empresa A, para probar que B no puede usarla.
  const invA = (await c.api('GET', '/inventory/inventarios', { who: 'A' }))
    .body;
  varianteDeA = invA[0].variante.idVariante;
}, 60000);

afterAll(() => backend?.stop());

describe('Sincronización offline (e2e)', () => {
  it('descarga el catálogo de la sucursal con stock, precio y hora del servidor', async () => {
    expect((await ponerStock(1)).status).toBe(200);
    const r = await c.api('GET', `/sync/catalog?sucursal=${idSucursal}`, {
      who: 'CLI',
    });
    expect(r.status).toBe(200);
    serverTime = r.body.serverTime;
    const producto = r.body.productos.find((p: any) =>
      p.variantes.some((v: any) => v.idVariante === idVariante),
    );
    precioFinal = producto.precioFinal;
    expect(
      producto.variantes.find((v: any) => v.idVariante === idVariante)
        .stockDisponible,
    ).toBe(1);
    expect(new Date(serverTime).getTime()).toBeGreaterThan(Date.now() - 60_000);
  });

  it('el catálogo de otra empresa no es visible (la sucursal de B no existe para A)', async () => {
    expect(
      (await c.api('GET', `/sync/catalog?sucursal=${idSucursal}`, { who: 'A' }))
        .status,
    ).toBe(404);
  });

  let primera: any;
  it('última unidad: la primera venta que llega se confirma y descuenta el stock', async () => {
    primera = venta();
    const [r] = await sync('B', primera);
    expect(r).toMatchObject({
      status: 'CONFIRMADA',
      conflictos: [],
      duplicada: false,
    });
    expect(r.serverId).toEqual(expect.any(Number));
    expect(await stockActual()).toBe(0);
    // La venta offline queda pagada con su pago registrado (efectivo = aprobado).
    const pagos = await c.api('GET', `/payments/venta/${r.serverId}`, { who: 'B' });
    expect(pagos.status).toBe(200);
    const lista = Array.isArray(pagos.body) ? pagos.body : [pagos.body];
    expect(lista[0]).toMatchObject({ metodo: 'EFECTIVO', estado: 'APROBADO' });
  });

  it('reenviar la misma operación devuelve el mismo resultado sin duplicar la venta', async () => {
    const [antes] = await sync('B', primera);
    const [r] = await sync('B', primera);
    expect(r).toMatchObject({
      status: 'CONFIRMADA',
      duplicada: true,
      serverId: antes.serverId,
    });
    expect(await stockActual()).toBe(0);
  });

  it('última unidad: una reserva que llega segunda no se crea y ofrece otra sucursal', async () => {
    const [r] = await sync('CLI', reserva());
    expect(r).toMatchObject({
      status: 'CONFLICTO',
      conflictos: ['SIN_STOCK'],
      serverId: null,
    });
    expect(r.alternativas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ idSucursal: otraSucursal, idVariante }),
      ]),
    );
    expect(await stockActual()).toBe(0);
  });

  it('última unidad: una venta presencial que llega segunda se registra con conflicto de stock', async () => {
    const [r] = await sync('B', venta());
    expect(r).toMatchObject({ status: 'CONFLICTO', conflictos: ['STOCK'] });
    expect(r.serverId).toEqual(expect.any(Number));
    expect(r.reason).toMatch(/Faltó stock/);
    expect(await stockActual()).toBe(0); // nunca negativo
  });

  it('con stock, la reserva offline se confirma y aparta la prenda', async () => {
    await ponerStock(3);
    const [r] = await sync('CLI', reserva());
    expect(r).toMatchObject({ status: 'CONFIRMADA', conflictos: [] });
    expect(await stockActual()).toBe(2);
  });

  it('precio distinto: se acepta si el catálogo era reciente y es conflicto si era viejo', async () => {
    const reciente = await sync('B', venta({ precio: precioFinal + 5 }));
    expect(reciente[0]).toMatchObject({ status: 'CONFIRMADA', conflictos: [] });

    const hace3dias = new Date(Date.now() - 72 * 3_600_000).toISOString();
    const [r] = await sync(
      'B',
      venta({ precio: precioFinal + 5, descargado: hace3dias }),
    );
    expect(r).toMatchObject({ status: 'CONFLICTO', conflictos: ['PRECIO'] });
    // Se registra lo que realmente se cobró.
    const v = await c.api('GET', `/sales/${r.serverId}`, { who: 'B' });
    expect(Number(v.body.total)).toBeCloseTo(precioFinal + 5, 2);
  });

  it('rechaza operaciones inválidas sin cortar el resto del lote', async () => {
    await ponerStock(5);
    const ok = venta();
    const results = await sync(
      'B',
      venta({ variante: 99999999 }),
      venta({ variante: varianteDeA }),
      ok,
    );
    const porId = Object.fromEntries(results.map((x) => [x.operationId, x]));
    expect(results.filter((x) => x.status === 'RECHAZADA')).toHaveLength(2);
    expect(porId[ok.operationId].status).toBe('CONFIRMADA');

    const [cliente] = await sync('CLI', venta());
    expect(cliente).toMatchObject({
      status: 'RECHAZADA',
      reason: 'Tu rol no puede registrar ventas',
    });
  });

  it('el panel muestra conflictos pendientes y el encargado los resuelve', async () => {
    const r = await c.api('GET', '/sync/operaciones?pendientes=true', {
      who: 'B',
    });
    expect(r.status).toBe(200);
    const conflicto = r.body.find(
      (o: any) => o.estado === 'CONFLICTO' && o.conflictos.includes('STOCK'),
    );
    expect(conflicto).toBeDefined();
    expect(conflicto.usuario).not.toHaveProperty('passwordHash');

    const resumen = (await c.api('GET', '/sync/resumen', { who: 'B' })).body;
    expect(resumen.pendientes).toBeGreaterThan(0);

    const ok = await c.api(
      'PATCH',
      `/sync/operaciones/${conflicto.idOperacionSync}/resolver`,
      {
        who: 'B',
        body: {
          nota: 'Ajuste de inventario +1 (prenda encontrada en depósito)',
        },
      },
    );
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ resuelta: true });
    const otraVez = await c.api(
      'PATCH',
      `/sync/operaciones/${conflicto.idOperacionSync}/resolver`,
      {
        who: 'B',
        body: { nota: 'otra vez' },
      },
    );
    expect(otraVez.status).toBe(400);
  });

  it('la Empresa A no ve ni resuelve operaciones de la Empresa B', async () => {
    const deB = (await c.api('GET', '/sync/operaciones', { who: 'B' })).body;
    const deA = (await c.api('GET', '/sync/operaciones', { who: 'A' })).body;
    const idsB = new Set(deB.map((o: any) => o.idOperacionSync));
    expect(deA.some((o: any) => idsB.has(o.idOperacionSync))).toBe(false);
    const r = await c.api(
      'PATCH',
      `/sync/operaciones/${deB[0].idOperacionSync}/resolver`,
      {
        who: 'A',
        body: { nota: 'intento ajeno' },
      },
    );
    expect(r.status).toBe(404);
  });

  afterAll(async () => {
    await ponerStock(5);
  });
});
