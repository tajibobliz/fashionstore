/**
 * Pruebas E2E del carrito de la tienda online.
 * Corrección: antes, con una sucursal de otra tienda (p. ej. guardada en el navegador),
 * "agregar" respondía 201 pero la prenda quedaba en un carrito ilegible (el contador seguía
 * en 0), y con un id inexistente daba 500. Además, cambiar o quitar un item fallaba si la
 * clienta tenía carritos en dos sucursales.
 * Ejecutar: npm run test:e2e:tenant
 */
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
let sucursalesB: number[];
let sucursalA: number;
let variantes: number[];

const vaciar = () =>
  Promise.all(
    sucursalesB.map((s) =>
      c.api('DELETE', `/cart/me?idSucursal=${s}`, { who: 'CLI' }),
    ),
  );

beforeAll(async () => {
  await assertRlsApplies();
  backend = await startBackend();
  c = client(backend.base);
  await c.login('A', {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });
  for (const [who, email] of [
    ['B', 'admin@urbanstep.demo'],
    ['CLI', 'cliente@urbanstep.demo'],
  ])
    await c.login(who, { email, password: DEMO_PASSWORD, empresa: DEMO_SLUG });
  sucursalesB = (await c.api('GET', '/branches/sucursales', { who: 'B' })).body
    .filter((s: any) => s.estado)
    .map((s: any) => s.idSucursal);
  sucursalA = (await c.api('GET', '/branches/sucursales', { who: 'A' })).body[0]
    .idSucursal;
  variantes = (await c.api('GET', '/catalog/variantes', { who: 'CLI' })).body
    .slice(0, 2)
    .map((v: any) => v.idVariante);
  await vaciar();
}, 60_000);

afterAll(async () => {
  await vaciar();
  backend?.stop();
});

describe('Carrito de la tienda online (e2e)', () => {
  it('rechaza una sucursal de otra empresa o inexistente (antes: 201 sin efecto o 500)', async () => {
    for (const idSucursal of [sucursalA, 999_999]) {
      const add = await c.api('POST', '/cart/items', {
        who: 'CLI',
        body: { idSucursal, idVariante: variantes[0], cantidad: 1 },
      });
      expect(add.status).toBe(404);
      expect(add.body.message).toMatch(/no está disponible en esta tienda/);
      expect(
        (
          await c.api('GET', `/cart/me?idSucursal=${idSucursal}`, {
            who: 'CLI',
          })
        ).status,
      ).toBe(404);
    }
  });

  it('lo agregado en una sucursal válida se ve en el carrito', async () => {
    const add = await c.api('POST', '/cart/items', {
      who: 'CLI',
      body: {
        idSucursal: sucursalesB[0],
        idVariante: variantes[0],
        cantidad: 2,
      },
    });
    expect(add.status).toBe(201);
    const mine = await c.api('GET', `/cart/me?idSucursal=${sucursalesB[0]}`, {
      who: 'CLI',
    });
    expect(mine.body.detalles).toHaveLength(1);
    expect(mine.body.detalles[0]).toMatchObject({ cantidad: 2 });
  });

  it('con carritos en dos sucursales, cambiar y quitar actúan sobre el item correcto', async () => {
    const otro = await c.api('POST', '/cart/items', {
      who: 'CLI',
      body: {
        idSucursal: sucursalesB[1],
        idVariante: variantes[1],
        cantidad: 1,
      },
    });
    const idDetalle = otro.body.detalles[0].idDetalleCarrito;
    const up = await c.api('PATCH', `/cart/items/${idDetalle}`, {
      who: 'CLI',
      body: { cantidad: 3 },
    });
    expect(up.status).toBe(200);
    expect(
      up.body.detalles.find((d: any) => d.idDetalleCarrito === idDetalle)
        .cantidad,
    ).toBe(3);
    const rm = await c.api('DELETE', `/cart/items/${idDetalle}`, {
      who: 'CLI',
    });
    expect(rm.status).toBe(200);
    expect(rm.body.detalles).toHaveLength(0);
    // El carrito de la otra sucursal no se tocó.
    const primero = await c.api(
      'GET',
      `/cart/me?idSucursal=${sucursalesB[0]}`,
      {
        who: 'CLI',
      },
    );
    expect(primero.body.detalles).toHaveLength(1);
  });

  it('nadie puede cambiar ni quitar items del carrito de otra persona', async () => {
    const mine = await c.api('GET', `/cart/me?idSucursal=${sucursalesB[0]}`, {
      who: 'CLI',
    });
    const idDetalle = mine.body.detalles[0].idDetalleCarrito;
    expect(
      (
        await c.api('PATCH', `/cart/items/${idDetalle}`, {
          who: 'B',
          body: { cantidad: 9 },
        })
      ).status,
    ).toBe(404);
    expect(
      (await c.api('DELETE', `/cart/items/${idDetalle}`, { who: 'A' })).status,
    ).toBe(404);
  });
});
