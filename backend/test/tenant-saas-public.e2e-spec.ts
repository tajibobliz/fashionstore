/**
 * Pruebas E2E de la página pública del SaaS: planes y contratación (auto-registro).
 * Ejecutar:  npm run test:e2e:tenant
 */
import {
  DEMO_SLUG,
  assertRlsApplies,
  client,
  startBackend,
  Backend,
} from './support/backend';

let backend: Backend;
let c: ReturnType<typeof client>;

beforeAll(async () => {
  await assertRlsApplies();
  backend = await startBackend();
  c = client(backend.base);
}, 60000);

afterAll(() => backend?.stop());

describe('SaaS público (e2e)', () => {
  it('lista los 3 planes con límites, funcionalidades y precio, sin iniciar sesión', async () => {
    const r = await c.api('GET', '/saas/planes');
    expect(r.status).toBe(200);
    expect(r.body.map((p: any) => p.codigo)).toEqual([
      'BASICO',
      'PROFESIONAL',
      'EMPRESARIAL',
    ]);
    expect(r.body[0]).toMatchObject({
      maxSucursales: 2,
      features: { aiReports: false },
    });
    expect(r.body.every((p: any) => p.precioReferencia > 0)).toBe(true);
  });

  it('informa si un slug está libre', async () => {
    expect(
      (await c.api('GET', `/saas/slug-disponible?slug=${DEMO_SLUG}`)).body
        .disponible,
    ).toBe(false);
    expect(
      (await c.api('GET', `/saas/slug-disponible?slug=libre-${Date.now()}`))
        .body.disponible,
    ).toBe(true);
    expect(
      (await c.api('GET', '/saas/slug-disponible?slug=admin')).body.disponible,
    ).toBe(false);
    expect(
      (await c.api('GET', '/saas/slug-disponible?slug=No Valido')).body
        .disponible,
    ).toBe(false);
  });

  it('contratar crea la empresa con su plan y deja la sesión del administrador iniciada', async () => {
    const slug = `contrata-${Date.now()}`;
    const r = await c.api('POST', '/saas/registro', {
      body: {
        nombre: 'Contrata E2E',
        slug,
        codigoPlan: 'EMPRESARIAL',
        admin: {
          nombre: 'Ana',
          email: `ana@${slug}.demo`,
          password: 'e2e-clave',
        },
      },
    });
    expect(r.status).toBe(201);
    expect(r.body.user).toMatchObject({ rol: 'ADMIN', empresa: { slug } });
    c.tokens.NUEVA = r.body.access_token;
    const me = (await c.api('GET', '/tenant/me', { who: 'NUEVA' })).body;
    expect(me).toMatchObject({
      empresa: { slug },
      plan: { codigo: 'EMPRESARIAL' },
      suscripcion: { estado: 'ACTIVA' },
    });
    expect(me.limites.sucursales.maximo).toBeNull();
    // La empresa nueva empieza vacía: no ve datos de otras empresas.
    expect(
      (await c.api('GET', '/catalog/productos', { who: 'NUEVA' })).body,
    ).toEqual([]);
  });

  it('rechaza slugs repetidos o reservados', async () => {
    const admin = {
      nombre: 'X',
      email: `x-${Date.now()}@e2e.demo`,
      password: 'e2e-clave',
    };
    expect(
      (
        await c.api('POST', '/saas/registro', {
          body: { nombre: 'X', slug: DEMO_SLUG, codigoPlan: 'BASICO', admin },
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await c.api('POST', '/saas/registro', {
          body: { nombre: 'X', slug: 'admin', codigoPlan: 'BASICO', admin },
        })
      ).status,
    ).toBe(400);
  });
});
