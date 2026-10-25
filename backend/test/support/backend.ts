/**
 * Utilidades para pruebas E2E: levanta el backend compilado (dist/main.js) en un puerto
 * aleatorio y ofrece un cliente HTTP mínimo. Así se prueba igual que lo usan la web y la app.
 */
import 'dotenv/config';
import { ChildProcess, spawn } from 'node:child_process';
import { join } from 'node:path';
import { Client } from 'pg';

export const DEMO_SLUG = 'urban-step';
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'demo1234';
export const ROOT_EMAIL =
  process.env.PLATFORM_ADMIN_EMAIL || 'superadmin@fashionstore.saas';
export const ROOT_PASSWORD =
  process.env.PLATFORM_ADMIN_PASSWORD || DEMO_PASSWORD;

export interface Backend {
  base: string;
  stop(): void;
}

/** Falla con un mensaje claro si la BD no va a aplicar RLS (evita falsos positivos). */
export async function assertRlsApplies() {
  const db = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl:
      String(process.env.DB_SSL).toLowerCase() === 'true'
        ? { rejectUnauthorized: true }
        : undefined,
  });
  await db.connect();
  const { rows } = await db.query(
    `SELECT rolsuper OR rolbypassrls AS bypass FROM pg_roles WHERE rolname = current_user`,
  );
  await db.end();
  if (rows[0].bypass) {
    throw new Error(
      'DB_USER es superusuario: RLS no aplica. Usa DB_USER=fashion_app (scripts/crear-rol-app.sql).',
    );
  }
}

export async function startBackend(): Promise<Backend> {
  const port = 3100 + Math.floor(Math.random() * 800);
  const base = `http://localhost:${port}`;
  const server: ChildProcess = spawn(
    process.execPath,
    [join(__dirname, '..', '..', 'dist', 'main.js')],
    {
      env: { ...process.env, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let log = '';
  server.stdout?.on('data', (d) => (log += d));
  server.stderr?.on('data', (d) => (log += d));
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${base}/health`)).ok)
        return { base, stop: () => server.kill() };
    } catch {
      /* todavía arrancando */
    }
    if (server.exitCode !== null) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  server.kill();
  throw new Error(`El backend no arrancó:\n${log}`);
}

export function client(base: string) {
  const tokens: Record<string, string> = {};
  async function api(
    method: string,
    path: string,
    opts: { who?: string; body?: object; tenant?: string } = {},
  ) {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };
    if (opts.who) headers.authorization = `Bearer ${tokens[opts.who]}`;
    if (opts.tenant) headers['x-tenant'] = opts.tenant;
    const res = await fetch(base + path, {
      method,
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const text = await res.text();
    let body: any = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return { status: res.status, body };
  }
  async function login(who: string, body: object) {
    const res = await api('POST', '/auth/login', { body });
    if (res.status !== 200)
      throw new Error(
        `Login de ${who} falló (${res.status}): ${JSON.stringify(res.body)} — ¿corriste npm run seed:demo?`,
      );
    tokens[who] = res.body.access_token;
    return res;
  }
  const tid = (who: string) =>
    JSON.parse(Buffer.from(tokens[who].split('.')[1], 'base64url').toString())
      .tid;
  return { api, login, tid, tokens };
}
