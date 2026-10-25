/**
 * Pruebas de aislamiento entre empresas (RNF02, enunciado §9.6) contra una BD real.
 * Levanta el backend compilado (dist/main.js) como proceso aparte y lo prueba por HTTP,
 * igual que lo usarían la web o la app móvil.
 *
 * Requisitos:
 *  1. BD con migraciones aplicadas:      npm run migration:run
 *  2. Empresa B de demostración:          npm run seed:demo
 *  3. backend/.env con un usuario de BD SIN superusuario (RLS no aplica a superusuarios):
 *       DB_USER=fashion_app               (ver scripts/crear-rol-app.sql)
 *  4. ADMIN_EMAIL / ADMIN_PASSWORD = admin de la Empresa A; DEMO_PASSWORD si se cambió.
 *
 * Ejecutar:  npm run test:e2e:tenant
 */
import {
  DEMO_PASSWORD,
  DEMO_SLUG,
  ROOT_EMAIL,
  ROOT_PASSWORD,
  assertRlsApplies,
  client,
  startBackend,
  Backend,
} from './support/backend';

let backend: Backend;
let api: ReturnType<typeof client>['api'];
let tid: ReturnType<typeof client>['tid'];

beforeAll(async () => {
  await assertRlsApplies();
  backend = await startBackend();
  const c = client(backend.base);
  ({ api, tid } = c);
  await c.login('A', {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });
  await c.login('B', {
    email: 'admin@urbanstep.demo',
    password: DEMO_PASSWORD,
    empresa: DEMO_SLUG,
  });
  await c.login('ROOT', { email: ROOT_EMAIL, password: ROOT_PASSWORD });
}, 60000);

afterAll(() => backend?.stop());

describe('Aislamiento multitenant (e2e)', () => {
  it('cada token lleva la empresa de su usuario (tid)', () => {
    expect(tid('A')).toEqual(expect.any(Number));
    expect(tid('B')).toEqual(expect.any(Number));
    expect(tid('B')).not.toBe(tid('A'));
    expect(tid('ROOT')).toBeNull();
  });

  it('el catálogo de cada empresa es independiente', async () => {
    const a = (await api('GET', '/catalog/categorias', { who: 'A' })).body;
    const b = (await api('GET', '/catalog/categorias', { who: 'B' })).body;
    expect(b.map((c: any) => c.nombre)).toEqual(
      expect.arrayContaining(['Zapatillas', 'Botas']),
    );
    expect(a.every((c: any) => c.idEmpresa === tid('A'))).toBe(true);
    expect(b.every((c: any) => c.idEmpresa === tid('B'))).toBe(true);
  });

  it('la tienda pública muestra los productos de la empresa del slug', async () => {
    const b = (await api('GET', '/catalog/productos', { tenant: DEMO_SLUG }))
      .body;
    expect(b.length).toBeGreaterThan(0);
    expect(b.every((p: any) => p.idEmpresa === tid('B'))).toBe(true);
    const porDefecto = (await api('GET', '/catalog/productos')).body;
    expect(porDefecto.every((p: any) => p.idEmpresa === tid('A'))).toBe(true);
  });

  it('enviar otro X-Tenant no permite cambiarse de empresa', async () => {
    const res = await api('GET', '/catalog/categorias', {
      who: 'B',
      tenant: 'fashionstore',
    });
    expect(res.body.every((c: any) => c.idEmpresa === tid('B'))).toBe(true);
  });

  it('la Empresa A no puede leer, editar ni borrar recursos de la B (404)', async () => {
    const ventaB = (await api('GET', '/sales', { who: 'B' })).body[0];
    const sucursalB = (await api('GET', '/branches/sucursales', { who: 'B' }))
      .body[0];
    const categoriaB = (await api('GET', '/catalog/categorias', { who: 'B' }))
      .body[0];
    expect(ventaB && sucursalB && categoriaB).toBeTruthy();

    expect(
      (await api('GET', `/sales/${ventaB.idVenta}`, { who: 'A' })).status,
    ).toBe(404);
    expect(
      (await api('PATCH', `/sales/${ventaB.idVenta}/cancelar`, { who: 'A' }))
        .status,
    ).toBe(404);
    expect(
      (
        await api('PATCH', `/branches/sucursales/${sucursalB.idSucursal}`, {
          who: 'A',
          body: { nombre: 'Intento de A' },
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await api('DELETE', `/catalog/categorias/${categoriaB.idCategoria}`, {
          who: 'A',
        })
      ).status,
    ).toBe(404);

    // Nada cambió en B.
    const sucursal = (
      await api('GET', `/branches/sucursales/${sucursalB.idSucursal}`, {
        who: 'B',
      })
    ).body;
    expect(sucursal.nombre).toBe(sucursalB.nombre);
    const venta = (await api('GET', `/sales/${ventaB.idVenta}`, { who: 'B' }))
      .body;
    expect(venta.estado).toBe(ventaB.estado);
  });

  it('las listas de ventas no se mezclan entre empresas', async () => {
    const a = (await api('GET', '/sales', { who: 'A' })).body;
    const b = (await api('GET', '/sales', { who: 'B' })).body;
    expect(b.length).toBeGreaterThan(0);
    expect(a.every((v: any) => v.idEmpresa === tid('A'))).toBe(true);
    expect(b.every((v: any) => v.idEmpresa === tid('B'))).toBe(true);
  });

  it('los reportes se calculan solo con datos de la propia empresa', async () => {
    const dashboard = (await api('GET', '/reports/dashboard', { who: 'B' }))
      .body;
    const ventas = (await api('GET', '/sales', { who: 'B' })).body;
    const total = ventas
      .filter((v: any) => v.estado === 'PAGADA')
      .reduce((s: number, v: any) => s + Number(v.total), 0);
    expect(Number(dashboard.totalVentas)).toBeCloseTo(total, 2);
  });

  it('un slug inexistente responde 404', async () => {
    expect(
      (await api('GET', '/catalog/productos', { tenant: 'no-existe' })).status,
    ).toBe(404);
  });

  it('el SUPER_ADMIN ve las sucursales de todas las empresas', async () => {
    const todas = (await api('GET', '/branches/sucursales', { who: 'ROOT' }))
      .body;
    const empresas = new Set(todas.map((s: any) => s.idEmpresa));
    expect(empresas.has(tid('A'))).toBe(true);
    expect(empresas.has(tid('B'))).toBe(true);
  });
});
