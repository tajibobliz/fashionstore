/**
 * Pruebas E2E de activar / desactivar usuarios de la empresa (ADMIN).
 * Desactivar corta el acceso en el momento: el token actual deja de servir, no puede iniciar
 * sesión ni renovar el token, y la app borra su acceso sin conexión (CU17).
 * Ejecutar: npm run test:e2e:tenant
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
let idNueva: number;
let refreshNueva: string;
const email = `baja-${randomUUID().slice(0, 8)}@prueba.demo`;
const clave = 'clave-segura-123';

const estado = (id: number, valor: unknown, who = 'B') =>
  c.api('PATCH', `/users/${id}/estado`, { who, body: { estado: valor } });
const login = () =>
  c.api('POST', '/auth/login', {
    body: { email, password: clave, empresa: DEMO_SLUG },
  });

beforeAll(async () => {
  await assertRlsApplies();
  backend = await startBackend();
  c = client(backend.base);
  await c.login('A', {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });
  for (const [who, mail] of [
    ['B', 'admin@urbanstep.demo'],
    ['ENC', 'encargado.centro@urbanstep.demo'],
  ])
    await c.login(who, {
      email: mail,
      password: DEMO_PASSWORD,
      empresa: DEMO_SLUG,
    });
  const reg = await c.api('POST', '/auth/register', {
    body: {
      nombre: 'Clienta',
      apellido: 'Baja',
      email,
      password: clave,
      empresa: DEMO_SLUG,
    },
  });
  expect(reg.status).toBe(201);
  idNueva = reg.body.user.idUsuario;
  refreshNueva = reg.body.refresh_token;
  await c.login('NUEVA', { email, password: clave, empresa: DEMO_SLUG });
}, 60_000);

afterAll(() => backend?.stop());

describe('Activar / desactivar usuarios (e2e)', () => {
  it('solo el ADMIN de la empresa puede hacerlo y el dato se valida', async () => {
    expect((await estado(idNueva, false, 'ENC')).status).toBe(403);
    expect((await estado(idNueva, false, 'NUEVA')).status).toBe(403);
    expect((await estado(idNueva, 'no')).status).toBe(400);
    // Otra empresa no lo ve (RLS): para ella el usuario no existe.
    expect((await estado(idNueva, false, 'A')).status).toBe(404);
  });

  it('nadie se desactiva a sí mismo', async () => {
    const me = (await c.api('GET', '/auth/profile', { who: 'B' })).body;
    const r = await estado(me.idUsuario, false);
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/tu propio usuario/);
  });

  it('al desactivarla pierde el acceso en el momento: token, login y renovación', async () => {
    expect((await c.api('GET', '/sales/me', { who: 'NUEVA' })).status).toBe(
      200,
    );
    const r = await estado(idNueva, false);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ idUsuario: idNueva, estado: false });
    expect(r.body.password).toBeUndefined();

    const conToken = await c.api('GET', '/sales/me', { who: 'NUEVA' });
    expect(conToken.status).toBe(401);
    expect(conToken.body.message).toMatch(/desactivado/);
    expect((await login()).status).toBe(401);
    expect(
      (
        await c.api('POST', '/auth/refresh', {
          body: { refresh_token: refreshNueva },
        })
      ).status,
    ).toBe(401);
    const lista = (await c.api('GET', '/users', { who: 'B' })).body;
    expect(lista.find((u: any) => u.idUsuario === idNueva).estado).toBe(false);
  });

  it('al reactivarla vuelve a entrar con su contraseña', async () => {
    expect((await estado(idNueva, true)).body.estado).toBe(true);
    const r = await login();
    expect(r.status).toBe(200);
    expect(r.body.user.idUsuario).toBe(idNueva);
  });
});
