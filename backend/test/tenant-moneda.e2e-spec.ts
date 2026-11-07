/**
 * Pruebas E2E de moneda: los planes del SaaS se cobran en USD y cada tienda vende en su
 * propia moneda (`empresa.moneda`, por defecto BOB).
 *
 * Se crea una tienda nueva en CLP para no tocar las empresas demo. Los reportes con IA usan
 * el proveedor simulado y muestran las columnas de montos con el símbolo de la tienda.
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
const slug = `moneda-${Date.now()}`;

const registrar = (body: object) =>
  c.api('POST', '/saas/registro', {
    body: {
      nombre: 'Tienda Moneda E2E',
      codigoPlan: 'EMPRESARIAL',
      admin: {
        nombre: 'Ana',
        email: `ana@${slug}.demo`,
        password: 'e2e-clave',
      },
      slug,
      ...body,
    },
  });

beforeAll(async () => {
  await assertRlsApplies();
  process.env.LLM_PROVIDER = 'simulado';
  backend = await startBackend();
  c = client(backend.base);
  await c.login('B', {
    email: 'admin@urbanstep.demo',
    password: DEMO_PASSWORD,
    empresa: DEMO_SLUG,
  });
  await c.login('ENC', {
    email: 'encargado.centro@urbanstep.demo',
    password: DEMO_PASSWORD,
    empresa: DEMO_SLUG,
  });
}, 60_000);

afterAll(() => backend?.stop());

describe('Moneda de la plataforma y de cada tienda (e2e)', () => {
  it('los planes se publican en USD y solo Empresarial incluye pagos en línea', async () => {
    const planes = (await c.api('GET', '/saas/planes')).body;
    expect(planes.every((p: any) => p.moneda === 'USD')).toBe(true);
    const precios = planes.map((p: any) => p.precioReferencia);
    expect(precios).toEqual([...precios].sort((a: number, b: number) => a - b));
    expect(
      Object.fromEntries(
        planes.map((p: any) => [p.codigo, p.features.pagosOnline]),
      ),
    ).toEqual({
      BASICO: false,
      PROFESIONAL: false,
      EMPRESARIAL: true,
    });
  });

  it('publica el catálogo de monedas (con sus decimales)', async () => {
    const r = await c.api('GET', '/saas/monedas');
    expect(r.status).toBe(200);
    expect(r.body).toEqual(
      expect.arrayContaining([
        { codigo: 'BOB', nombre: 'Boliviano', simbolo: 'Bs', decimales: 2 },
        expect.objectContaining({ codigo: 'CLP', decimales: 0 }),
      ]),
    );
  });

  it('una tienda se registra con su moneda y la ve en la sesión, en /tenant/me y en su página pública', async () => {
    expect((await registrar({ moneda: 'XXX' })).status).toBe(400);

    const r = await registrar({ moneda: 'CLP' });
    expect(r.status).toBe(201);
    expect(r.body.user.empresa).toMatchObject({ slug, moneda: 'CLP' });
    c.tokens.NUEVA = r.body.access_token;
    // El plan (Empresarial, con IA) se activa al pagar.
    await c.api(
      'POST',
      `/billing/simulado/${r.body.checkout.referencia}/pagar`,
      {
        who: 'NUEVA',
      },
    );
    expect(
      (await c.api('GET', '/tenant/me', { who: 'NUEVA' })).body.empresa.moneda,
    ).toBe('CLP');
    expect((await c.api('GET', `/saas/tiendas/${slug}`)).body.moneda).toBe(
      'CLP',
    );
    // Las tiendas existentes siguen en bolivianos.
    expect((await c.api('GET', `/saas/tiendas/${DEMO_SLUG}`)).body.moneda).toBe(
      'BOB',
    );
  });

  it('los reportes con IA muestran los montos con el símbolo de la tienda', async () => {
    const r = await c.api('POST', '/ai/reports/query', {
      who: 'NUEVA',
      body: { consulta: '#ventas_por_sucursal {}' },
    });
    expect(r.status).toBe(200);
    const rep = r.body.reportes[0];
    expect(rep.moneda).toBe('CLP');
    expect(
      rep.columnas.find((col: any) => col.formato === 'moneda').etiqueta,
    ).toBe('Total ($)');
  });

  it('solo el administrador cambia la moneda, con códigos válidos, y sin afectar a otras tiendas', async () => {
    expect(
      (
        await c.api('PATCH', '/tenant/moneda', {
          who: 'ENC',
          body: { moneda: 'USD' },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await c.api('PATCH', '/tenant/moneda', {
          who: 'NUEVA',
          body: { moneda: 'ABC' },
        })
      ).status,
    ).toBe(400);

    const r = await c.api('PATCH', '/tenant/moneda', {
      who: 'NUEVA',
      body: { moneda: 'USD' },
    });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ moneda: 'USD' });
    expect(
      (await c.api('GET', '/tenant/me', { who: 'NUEVA' })).body.empresa.moneda,
    ).toBe('USD');
    expect(
      (await c.api('GET', '/tenant/me', { who: 'B' })).body.empresa.moneda,
    ).toBe('BOB');
    // Al recargar la página la sesión se restaura con /auth/profile: debe traer la moneda nueva.
    expect(
      (await c.api('GET', '/auth/profile', { who: 'NUEVA' })).body.empresa,
    ).toMatchObject({ slug, moneda: 'USD' });

    const ia = await c.api('POST', '/ai/reports/query', {
      who: 'NUEVA',
      body: { consulta: '#ventas_por_sucursal {}' },
    });
    expect(
      ia.body.reportes[0].columnas.find((col: any) => col.formato === 'moneda')
        .etiqueta,
    ).toBe('Total (US$)');
  });
});
