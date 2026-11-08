/**
 * Pruebas E2E de la portada de la tienda online y del catálogo de la tienda demo.
 * El administrador elige la imagen grande (ENLACE https, se conserva al desplegar) y la frase de
 * su portada /t/:slug. La tienda demo Urban Step es de moda para mujer y cada prenda tiene foto
 * (migración 1780000000015 / seed de demo).
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
import { CATALOGO_DEMO } from '../src/tenancy/seeds/catalogo-demo';

let backend: Backend;
let c: ReturnType<typeof client>;
let original: { portadaUrl: string | null; eslogan: string | null };

const portada = (body: object, who = 'B') =>
  c.api('PATCH', '/tenant/portada', { who, body });
const publica = async (slug = DEMO_SLUG) =>
  (await c.api('GET', `/saas/tiendas/${slug}`)).body;

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
  const { portadaUrl, eslogan } = await publica();
  original = { portadaUrl: portadaUrl ?? null, eslogan: eslogan ?? null };
}, 60_000);

afterAll(async () => {
  if (original) await portada(original);
  backend?.stop();
});

describe('Portada de la tienda online (e2e)', () => {
  it('el administrador guarda imagen y frase, y la tienda pública las muestra', async () => {
    const url = 'https://example.com/portada.jpg';
    const r = await portada({
      portadaUrl: url,
      eslogan: '  Nueva temporada  ',
    });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ portadaUrl: url, eslogan: 'Nueva temporada' });
    expect(await publica()).toMatchObject({
      portadaUrl: url,
      eslogan: 'Nueva temporada',
    });
    // Vacío = quitar.
    expect((await portada({ portadaUrl: '' })).body.portadaUrl).toBeNull();
  });

  it('solo acepta enlaces https y frases cortas', async () => {
    const http = await portada({ portadaUrl: 'http://example.com/a.jpg' });
    expect(http.status).toBe(400);
    expect(String(http.body.message)).toMatch(/https/);
    expect((await portada({ eslogan: 'x'.repeat(161) })).status).toBe(400);
  });

  it('una clienta no puede cambiarla y cada empresa cambia solo la suya', async () => {
    expect((await portada({ eslogan: 'hola' }, 'CLI')).status).toBe(403);
    const antesA = await publica('fashionstore');
    await portada({ eslogan: 'Solo Urban Step' });
    expect((await publica('fashionstore')).eslogan).toBe(antesA.eslogan);
  });
});

describe('Catálogo de la tienda demo (e2e)', () => {
  it('es de moda para mujer y cada prenda del demo tiene foto', async () => {
    const productos = (await c.api('GET', '/catalog/productos', { who: 'CLI' }))
      .body;
    const porNombre = new Map(productos.map((p: any) => [p.nombre, p]));
    for (const prenda of CATALOGO_DEMO)
      expect(porNombre.get(prenda.nombre)).toMatchObject({
        imagenUrl: expect.stringMatching(/^https:\/\//),
      });
    for (const viejo of [
      'Zapatilla Runner Pro',
      'Buzo Deportivo',
      'Mochila Urbana',
    ])
      expect(porNombre.has(viejo)).toBe(false);
  });
});
