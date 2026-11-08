/**
 * Pruebas E2E de lo que el servidor aporta a la sesión offline con PIN (P3 / CU17).
 * El PIN y el token cifrado viven en el navegador; el servidor define el plazo máximo por
 * empresa y, al volver la red, confirma que el usuario sigue activo y con qué rol.
 * Al terminar se restaura el plazo original de Urban Step.
 * Ejecutar: npm run test:e2e:tenant
 */
import { randomUUID } from 'node:crypto';
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
let horasOriginales: number;

const plazo = (horasSesionOffline: unknown, who = 'B') =>
  c.api('PATCH', '/tenant/sesion-offline', {
    who,
    body: { horasSesionOffline },
  });
const perfil = (who: string) => c.api('GET', '/auth/profile', { who });

async function sql(texto: string, params: unknown[] = []) {
  const db = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  await db.connect();
  try {
    return (await db.query(texto, params)).rows;
  } finally {
    await db.end();
  }
}

beforeAll(async () => {
  await assertRlsApplies();
  backend = await startBackend();
  c = client(backend.base);
  for (const [who, email] of [
    ['B', 'admin@urbanstep.demo'],
    ['ENC', 'encargado.centro@urbanstep.demo'],
    ['CLI', 'cliente@urbanstep.demo'],
  ])
    await c.login(who, { email, password: DEMO_PASSWORD, empresa: DEMO_SLUG });
  horasOriginales = (await perfil('B')).body.empresa.horasSesionOffline;
}, 60_000);

afterAll(async () => {
  if (horasOriginales) await plazo(horasOriginales);
  backend?.stop();
});

describe('Sesión offline con PIN: parte del servidor (e2e)', () => {
  it('el login y el perfil traen el plazo offline de la empresa', async () => {
    const r = await c.api('POST', '/auth/login', {
      body: {
        email: 'cliente@urbanstep.demo',
        password: DEMO_PASSWORD,
        empresa: DEMO_SLUG,
      },
    });
    expect(r.body.user.empresa).toMatchObject({
      slug: DEMO_SLUG,
      horasSesionOffline: expect.any(Number),
    });
    const p = await perfil('CLI');
    expect(p.status).toBe(200);
    expect(p.body).toMatchObject({
      rol: 'CLIENTE',
      nombre: expect.any(String),
      empresa: { slug: DEMO_SLUG, horasSesionOffline: horasOriginales },
    });
  });

  it('solo el ADMIN cambia el plazo, entre 1 hora y 30 días', async () => {
    expect((await plazo(24, 'ENC')).status).toBe(403);
    expect((await plazo(24, 'CLI')).status).toBe(403);
    for (const malo of [0, 721, 2.5, 'mucho'])
      expect((await plazo(malo)).status).toBe(400);
    const ok = await plazo(24);
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ horasSesionOffline: 24 });
    expect((await perfil('CLI')).body.empresa.horasSesionOffline).toBe(24);
  });

  it('si el usuario fue desactivado, el perfil lo rechaza (la app borra su sesión offline)', async () => {
    const email = `offline-${randomUUID().slice(0, 8)}@prueba.demo`;
    const reg = await c.api('POST', '/auth/register', {
      body: {
        nombre: 'Clienta',
        apellido: 'Offline',
        email,
        password: 'clave-segura-123',
        empresa: DEMO_SLUG,
      },
    });
    expect(reg.status).toBe(201);
    await c.login('NUEVA', {
      email,
      password: 'clave-segura-123',
      empresa: DEMO_SLUG,
    });
    expect((await perfil('NUEVA')).status).toBe(200);
    await sql(`UPDATE usuario SET estado = false WHERE email = $1`, [email]);
    const r = await perfil('NUEVA');
    expect(r.status).toBe(401);
    expect(r.body.message).toMatch(/desactivado/);
  });
});
