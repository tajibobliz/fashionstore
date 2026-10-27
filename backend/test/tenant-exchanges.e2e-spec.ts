/**
 * Pruebas E2E de cambios de prendas (Fase 2, tarea 2.5) contra una BD real.
 *
 * Regla: la clienta puede cambiar prendas de una venta pagada dentro del plazo de la empresa
 * (`plazo_cambio_dias`), solo unidades no devueltas ni cambiadas antes, y la prenda nueva
 * debe tener stock en la sucursal. Si cuesta más, se registra cómo paga la diferencia.
 *
 * Requisitos: los mismos que tenant-isolation. Ejecutar: npm run test:e2e:tenant
 */
import { Client } from 'pg';
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
let idSucursal: number;
let idCaja: number;
let A: { idVariante: number; precio: number; inv: number };
let B: { idVariante: number; precio: number; inv: number };
let C: { idVariante: number; precio: number; inv: number };
let idVenta: number;
let linea: number;

const stock = async (idVariante: number) =>
  (
    await c.api('GET', `/sync/catalog?sucursal=${idSucursal}`, { who: 'B' })
  ).body.productos
    .flatMap((p: any) => p.variantes)
    .find((v: any) => v.idVariante === idVariante).stockDisponible;
const ponerStock = (inv: number, n: number) =>
  c.api('PATCH', `/inventory/inventarios/${inv}`, {
    who: 'B',
    body: { stockDisponible: n },
  });
const cambiar = (body: object) =>
  c.api('POST', '/exchanges', { who: 'B', body });
const politica = (dias: number) =>
  c.api('PATCH', '/exchanges/politica', {
    who: 'B',
    body: { plazoCambioDias: dias },
  });

/** Conexión directa a la BD (rol sin superusuario) solo para simular una venta antigua. */
async function moverFechaVenta(dias: number) {
  const db = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  await db.connect();
  await db.query(
    `UPDATE venta SET fecha = now() - ($1 || ' days')::interval WHERE id_venta = $2`,
    [dias, idVenta],
  );
  await db.end();
}

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

  // Sucursal, caja y turno propios de la prueba.
  const inventarios = (
    await c.api('GET', '/inventory/inventarios', { who: 'B' })
  ).body.filter((i: any) => i.almacen?.codigo === 'PRINCIPAL');
  idSucursal = inventarios[0].sucursal.idSucursal;
  const cajas = (
    await c.api('GET', `/pos/cajas/sucursal/${idSucursal}`, { who: 'B' })
  ).body;
  let caja = cajas.find((x: any) => x.codigo === 'E2E-SYNC');
  if (!caja)
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
  idCaja = caja.idCaja;
  const turno = await c.api('GET', `/pos/turnos/actual?idCaja=${idCaja}`, {
    who: 'B',
  });
  if (turno.status !== 200)
    await c.api('POST', '/pos/turnos/abrir', {
      who: 'B',
      body: { idCaja, montoApertura: 0 },
    });

  // A y B: mismo producto (otra talla/color, mismo precio). C: un producto más caro.
  const productos = (
    await c.api('GET', `/sync/catalog?sucursal=${idSucursal}`, { who: 'B' })
  ).body.productos;
  const conDos = productos
    .filter((p: any) => p.variantes.length >= 2)
    .sort((x: any, y: any) => x.precioFinal - y.precioFinal);
  const barato = conDos[0];
  const caro = productos
    .filter((p: any) => p.precioFinal > barato.precioFinal)
    .sort((x: any, y: any) => y.precioFinal - x.precioFinal)[0];
  const inv = (idVariante: number) =>
    inventarios.find(
      (i: any) =>
        i.sucursal.idSucursal === idSucursal &&
        i.variante.idVariante === idVariante,
    ).idInventario;
  A = {
    idVariante: barato.variantes[0].idVariante,
    precio: barato.precioFinal,
    inv: inv(barato.variantes[0].idVariante),
  };
  B = {
    idVariante: barato.variantes[1].idVariante,
    precio: barato.precioFinal,
    inv: inv(barato.variantes[1].idVariante),
  };
  C = {
    idVariante: caro.variantes[0].idVariante,
    precio: caro.precioFinal,
    inv: inv(caro.variantes[0].idVariante),
  };
  for (const v of [A, B, C]) await ponerStock(v.inv, 5);
  await politica(7);

  // Una venta presencial de 3 unidades de A.
  const venta = await c.api('POST', '/sales/presencial', {
    who: 'B',
    body: {
      idSucursal,
      idCaja,
      detalles: [{ idVariante: A.idVariante, cantidad: 3 }],
    },
  });
  expect(venta.status).toBe(201);
  idVenta = venta.body.idVenta;
  linea = venta.body.detalles[0].idDetalleVenta;
}, 60000);

afterAll(async () => {
  await politica(7);
  backend?.stop();
});

describe('Cambios de prendas (e2e)', () => {
  it('la venta reciente está dentro del plazo y muestra las unidades disponibles', async () => {
    const r = await c.api('GET', `/exchanges/venta/${idVenta}`, { who: 'B' });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      plazoCambioDias: 7,
      dentroDelPlazo: true,
      admiteCambio: true,
    });
    expect(r.body.detalles[0]).toMatchObject({ cantidad: 3, disponibles: 3 });
    expect(await stock(A.idVariante)).toBe(2);
  });

  it('cambio de talla/color: vuelve la prenda original y sale la nueva, sin diferencia', async () => {
    const r = await cambiar({
      idVenta,
      motivo: 'Le quedaba chica',
      detalles: [
        { idDetalleVenta: linea, cantidad: 1, idVarianteNueva: B.idVariante },
      ],
    });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ diferencia: 0, metodoPagoDiferencia: null });
    expect(await stock(A.idVariante)).toBe(3);
    expect(await stock(B.idVariante)).toBe(4);
  });

  it('una prenda más cara exige el método de pago de la diferencia', async () => {
    const sin = await cambiar({
      idVenta,
      detalles: [
        { idDetalleVenta: linea, cantidad: 1, idVarianteNueva: C.idVariante },
      ],
    });
    expect(sin.status).toBe(400);
    expect(sin.body.message).toMatch(/diferencia/);

    const con = await cambiar({
      idVenta,
      metodoPagoDiferencia: 'QR',
      detalles: [
        { idDetalleVenta: linea, cantidad: 1, idVarianteNueva: C.idVariante },
      ],
    });
    expect(con.status).toBe(201);
    expect(con.body.diferencia).toBeCloseTo(C.precio - A.precio, 2);
    expect(con.body.metodoPagoDiferencia).toBe('QR');
    expect(await stock(C.idVariante)).toBe(4);
  });

  it('no se cambian más unidades de las que quedan ni sin stock de la prenda nueva', async () => {
    const demasiadas = await cambiar({
      idVenta,
      detalles: [
        { idDetalleVenta: linea, cantidad: 2, idVarianteNueva: B.idVariante },
      ],
    });
    expect(demasiadas.status).toBe(400);
    expect(demasiadas.body.message).toMatch(/Solo quedan 1/);

    await ponerStock(B.inv, 0);
    const sinStock = await cambiar({
      idVenta,
      detalles: [
        { idDetalleVenta: linea, cantidad: 1, idVarianteNueva: B.idVariante },
      ],
    });
    expect(sinStock.status).toBe(400);
    expect(sinStock.body.message).toMatch(/No hay stock/);
    await ponerStock(B.inv, 5);
  });

  it('las unidades cambiadas ya no se pueden devolver', async () => {
    const dos = await c.api('POST', '/returns', {
      who: 'B',
      body: { idVenta, detalles: [{ idDetalleVenta: linea, cantidad: 2 }] },
    });
    expect(dos.status).toBe(400);
    expect(dos.body.message).toMatch(/ya se cambiaron/);
  });

  it('fuera del plazo de la empresa no se aceptan cambios', async () => {
    await moverFechaVenta(10);
    const r = await cambiar({
      idVenta,
      detalles: [
        { idDetalleVenta: linea, cantidad: 1, idVarianteNueva: B.idVariante },
      ],
    });
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/Fuera de plazo/);
    const e = await c.api('GET', `/exchanges/venta/${idVenta}`, { who: 'B' });
    expect(e.body.dentroDelPlazo).toBe(false);

    // Si la empresa amplía el plazo a 15 días, vuelve a estar dentro.
    expect((await politica(15)).body).toEqual({ plazoCambioDias: 15 });
    expect(
      (await c.api('GET', `/exchanges/venta/${idVenta}`, { who: 'B' })).body
        .dentroDelPlazo,
    ).toBe(true);
    await moverFechaVenta(0);
  });

  it('solo el ADMIN cambia el plazo; otra empresa no ve la venta ni sus cambios', async () => {
    expect(
      (
        await c.api('PATCH', '/exchanges/politica', {
          who: 'CLI',
          body: { plazoCambioDias: 30 },
        })
      ).status,
    ).toBe(403);
    expect(
      (await c.api('GET', `/exchanges/venta/${idVenta}`, { who: 'A' })).status,
    ).toBe(404);
    const deA = (await c.api('GET', '/exchanges', { who: 'A' })).body;
    expect(deA.some((x: any) => x.venta.idVenta === idVenta)).toBe(false);
    const deB = (await c.api('GET', '/exchanges', { who: 'B' })).body;
    expect(deB.filter((x: any) => x.venta.idVenta === idVenta)).toHaveLength(2);
  });
});
