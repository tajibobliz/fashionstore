/**
 * Pruebas E2E del almacén PRINCIPAL de cada sucursal.
 * Reservas, compras online, devoluciones, cambios, el catálogo offline y los traspasos lo buscan
 * por su código. En la empresa original (FashionStore) se había renombrado a A1/A2 y esas
 * operaciones fallaban; la migración 1780000000013 lo reparó y ahora no se puede renombrar,
 * desactivar ni mover. Su nombre visible sí se puede cambiar.
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

const principales = async (who: string) =>
  (await c.api('GET', '/warehouses', { who })).body.filter(
    (a: any) => a.codigo === 'PRINCIPAL',
  );

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
}, 60_000);

afterAll(() => backend?.stop());

describe('Almacén principal de cada sucursal (e2e)', () => {
  it('toda sucursal activa de cada empresa tiene su almacén PRINCIPAL activo', async () => {
    for (const who of ['A', 'B']) {
      const sucursales = (
        await c.api('GET', '/branches/sucursales', { who })
      ).body.filter((s: any) => s.estado);
      const conPrincipal = new Set(
        (await principales(who))
          .filter((a: any) => a.estado)
          .map((a: any) => a.sucursal.idSucursal),
      );
      for (const s of sucursales)
        expect(conPrincipal.has(s.idSucursal)).toBe(true);
    }
  });

  it('no se puede renombrar, desactivar ni mover; el nombre visible sí', async () => {
    const [p] = await principales('B');
    const patch = (body: object) =>
      c.api('PATCH', `/warehouses/${p.idAlmacen}`, { who: 'B', body });
    expect((await patch({ codigo: 'A1' })).body.message).toMatch(
      /no se puede cambiar/,
    );
    expect((await patch({ estado: false })).body.message).toMatch(
      /no se puede desactivar/,
    );
    const otra = (
      await c.api('GET', '/branches/sucursales', { who: 'B' })
    ).body.find((s: any) => s.idSucursal !== p.sucursal.idSucursal);
    if (otra)
      expect(
        (await patch({ idSucursal: otra.idSucursal })).body.message,
      ).toMatch(/no se puede mover/);
    expect(
      (await c.api('DELETE', `/warehouses/${p.idAlmacen}`, { who: 'B' }))
        .status,
    ).toBe(400);

    const renombrado = await patch({ nombre: 'Depósito central' });
    expect(renombrado.status).toBe(200);
    expect(renombrado.body).toMatchObject({
      codigo: 'PRINCIPAL',
      nombre: 'Depósito central',
      estado: true,
    });
    await patch({ nombre: p.nombre });
  });

  it('el código PRINCIPAL está reservado para otros almacenes', async () => {
    const [p] = await principales('B');
    const crear = await c.api('POST', '/warehouses', {
      who: 'B',
      body: {
        idSucursal: p.sucursal.idSucursal,
        codigo: 'principal',
        nombre: 'Otro',
      },
    });
    expect(crear.status).toBe(400);
    expect(crear.body.message).toMatch(/reservado/);
  });

  it('con el principal reparado, la empresa original puede reservar', async () => {
    const sucursal = (
      await c.api('GET', '/branches/sucursales', { who: 'A' })
    ).body.find((s: any) => s.estado);
    const inv = (
      await c.api('GET', '/inventory/inventarios', { who: 'A' })
    ).body.find(
      (i: any) =>
        i.sucursal.idSucursal === sucursal.idSucursal &&
        i.almacen?.codigo === 'PRINCIPAL' &&
        i.stockDisponible > 0,
    );
    if (!inv) return; // sin stock en la base de prueba: nada más que verificar
    const r = await c.api('POST', '/reservations', {
      who: 'A',
      body: {
        idSucursal: sucursal.idSucursal,
        detalles: [{ idVariante: inv.variante.idVariante, cantidad: 1 }],
        clientRequestId: crypto.randomUUID(),
      },
    });
    expect(r.status).toBe(201);
    await c.api('PATCH', `/reservations/${r.body.idReserva}/cancelar`, {
      who: 'A',
    });
  });
});
