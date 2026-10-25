/**
 * Pruebas E2E de planes y suscripciones (enunciado §9.3–9.5):
 * registro de empresas por el SUPER_ADMIN, límites del plan, funcionalidades por plan,
 * cambio de plan, vencimiento y suspensión. Todo se valida en el backend.
 *
 * Usa una empresa propia de pruebas ("e2e-planes") que se reinicia al empezar,
 * así se puede ejecutar muchas veces. Requisitos: los mismos que tenant-isolation.
 *
 * Ejecutar:  npm run test:e2e:tenant
 */
import {
  ROOT_EMAIL,
  ROOT_PASSWORD,
  assertRlsApplies,
  client,
  startBackend,
  Backend,
} from './support/backend';

const SLUG = 'e2e-planes';
const ADMIN = {
  nombre: 'Admin',
  apellido: 'E2E',
  email: 'admin@e2e-planes.demo',
  password: 'e2e-clave',
};

let backend: Backend;
let c: ReturnType<typeof client>;
let idEmpresa: number;
let idCiudad: number;

const loginC = () =>
  c.login('C', { email: ADMIN.email, password: ADMIN.password, empresa: SLUG });
const me = async () => (await c.api('GET', '/tenant/me', { who: 'C' })).body;
const crearSucursal = (n: string) =>
  c.api('POST', '/branches/sucursales', {
    who: 'C',
    body: { nombre: `Sucursal ${n}`, direccion: `Calle ${n}`, idCiudad },
  });

beforeAll(async () => {
  await assertRlsApplies();
  backend = await startBackend();
  c = client(backend.base);
  await c.login('ROOT', { email: ROOT_EMAIL, password: ROOT_PASSWORD });

  // Crear (o reutilizar) la empresa de pruebas y dejarla en plan BÁSICO vigente y activa.
  const creada = await c.api('POST', '/platform/empresas', {
    who: 'ROOT',
    body: {
      nombre: 'Empresa E2E Planes',
      slug: SLUG,
      codigoPlan: 'BASICO',
      admin: ADMIN,
    },
  });
  if (creada.status === 201) idEmpresa = creada.body.empresa.idEmpresa;
  else {
    expect(creada.status).toBe(409);
    const todas = (await c.api('GET', '/platform/empresas', { who: 'ROOT' }))
      .body;
    idEmpresa = todas.find((e: any) => e.empresa.slug === SLUG).empresa
      .idEmpresa;
  }
  await c.api('PATCH', `/platform/empresas/${idEmpresa}/estado`, {
    who: 'ROOT',
    body: { estado: 'ACTIVA' },
  });
  await c.api('POST', `/platform/empresas/${idEmpresa}/suscripcion`, {
    who: 'ROOT',
    body: { codigoPlan: 'BASICO' },
  });
  await loginC();
  idCiudad = (await c.api('GET', '/branches/ciudades')).body[0].idCiudad;
}, 60000);

afterAll(() => backend?.stop());

describe('Planes y suscripciones (e2e)', () => {
  it('el SUPER_ADMIN registra la empresa con su plan y su administrador', async () => {
    const r = await c.api('GET', `/platform/empresas/${idEmpresa}`, {
      who: 'ROOT',
    });
    expect(r.body).toMatchObject({
      empresa: { slug: SLUG, estado: 'ACTIVA' },
      plan: { codigo: 'BASICO' },
    });
    expect(c.tid('C')).toBe(idEmpresa);
  });

  it('solo el SUPER_ADMIN usa /platform', async () => {
    expect(
      (await c.api('GET', '/platform/empresas', { who: 'C' })).status,
    ).toBe(403);
  });

  it('/tenant/me muestra plan, vigencia, límites y uso', async () => {
    const r = await me();
    expect(r.plan.codigo).toBe('BASICO');
    expect(r.suscripcion).toMatchObject({ estado: 'ACTIVA' });
    expect(r.suscripcion.diasRestantes).toBeGreaterThan(0);
    expect(r.limites.sucursales.maximo).toBe(2);
    expect(r.limites.usuarios.maximo).toBe(5);
  });

  it('el plan Básico no permite más de 2 sucursales activas', async () => {
    let usadas = (await me()).limites.sucursales.usadas;
    while (usadas < 2) {
      expect((await crearSucursal(`#${usadas + 1}`)).status).toBe(201);
      usadas++;
    }
    const extra = await crearSucursal('extra');
    expect(extra.status).toBe(403);
    expect(extra.body.code).toBe('LIMITE_DEL_PLAN');
  });

  it('el plan Básico no permite más de 5 empleados activos', async () => {
    let usados = (await me()).limites.usuarios.usados;
    for (let i = 1; usados < 5; i++) {
      const r = await c.api('POST', '/users', {
        who: 'C',
        body: {
          nombre: `Empleado ${i}`,
          email: `empleado${i}@e2e-planes.demo`,
          password: 'e2e-clave',
          rolNombre: 'ENCARGADO',
        },
      });
      if (r.status === 201) usados++;
      else expect(r.status).toBe(409); // ya existía de una corrida anterior
    }
    const extra = await c.api('POST', '/users', {
      who: 'C',
      body: {
        nombre: 'Uno más',
        email: `extra-${Date.now()}@e2e-planes.demo`,
        password: 'e2e-clave',
        rolNombre: 'ENCARGADO',
      },
    });
    expect(extra.status).toBe(403);
    expect(extra.body.code).toBe('LIMITE_DEL_PLAN');
  });

  it('los clientes no cuentan para el límite de usuarios', async () => {
    const r = await c.api('POST', '/auth/register', {
      tenant: SLUG,
      body: {
        nombre: 'Clienta',
        email: `clienta-${Date.now()}@e2e-planes.demo`,
        password: 'e2e-clave',
      },
    });
    expect(r.status).toBe(201);
  });

  it('los reportes generativos con IA no están en el plan Básico', async () => {
    const r = await c.api('POST', '/ai/reporte-voz', {
      who: 'C',
      body: { consulta: 'ventas de hoy' },
    });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('PLAN_SIN_FUNCIONALIDAD');
  });

  it('al pasar a Profesional se habilitan la IA y más sucursales; el historial se conserva', async () => {
    await c.api('POST', `/platform/empresas/${idEmpresa}/suscripcion`, {
      who: 'ROOT',
      body: { codigoPlan: 'PROFESIONAL' },
    });
    const r = await me();
    expect(r.plan).toMatchObject({
      codigo: 'PROFESIONAL',
      features: { aiReports: true },
    });
    expect(r.limites.sucursales.maximo).toBe(10);
    const historial = (
      await c.api('GET', '/tenant/suscripciones', { who: 'C' })
    ).body;
    expect(historial[0]).toMatchObject({ estado: 'ACTIVA' });
    expect(historial.some((s: any) => s.estado === 'CANCELADA')).toBe(true);
    await c.api('POST', `/platform/empresas/${idEmpresa}/suscripcion`, {
      who: 'ROOT',
      body: { codigoPlan: 'BASICO' },
    });
  });

  it('con la suscripción vencida solo se puede consultar, hasta renovar', async () => {
    await c.api(
      'PATCH',
      `/platform/empresas/${idEmpresa}/suscripcion/vencimiento`,
      {
        who: 'ROOT',
        body: { fechaVencimiento: '2020-01-01' },
      },
    );
    expect((await me()).suscripcion.estado).toBe('VENCIDA');
    const bloqueada = await c.api('POST', '/catalog/categorias', {
      who: 'C',
      body: { nombre: `Cat ${Date.now()}` },
    });
    expect(bloqueada.status).toBe(403);
    expect(bloqueada.body.code).toBe('SUSCRIPCION_VENCIDA');
    expect(
      (await c.api('GET', '/catalog/categorias', { who: 'C' })).status,
    ).toBe(200);

    // El administrador renueva (contratación simulada) y vuelve a operar.
    expect(
      (
        await c.api('POST', '/tenant/suscripcion', {
          who: 'C',
          body: { codigoPlan: 'BASICO' },
        })
      ).status,
    ).toBe(201);
    const nueva = await c.api('POST', '/catalog/categorias', {
      who: 'C',
      body: { nombre: `Cat ${Date.now()}` },
    });
    expect(nueva.status).toBe(201);
  });

  it('una empresa suspendida no puede iniciar sesión ni operar', async () => {
    await c.api('PATCH', `/platform/empresas/${idEmpresa}/estado`, {
      who: 'ROOT',
      body: { estado: 'SUSPENDIDA' },
    });
    const login = await c.api('POST', '/auth/login', {
      body: { email: ADMIN.email, password: ADMIN.password, empresa: SLUG },
    });
    expect(login.status).toBe(403);
    const operar = await crearSucursal('suspendida');
    expect(operar.status).toBe(403);
    await c.api('PATCH', `/platform/empresas/${idEmpresa}/estado`, {
      who: 'ROOT',
      body: { estado: 'ACTIVA' },
    });
  });

  it('los límites son configurables desde el backend', async () => {
    const planes = (await c.api('GET', '/platform/planes', { who: 'ROOT' }))
      .body;
    const basico = planes.find((p: any) => p.codigo === 'BASICO');
    await c.api('PATCH', `/platform/planes/${basico.idPlan}`, {
      who: 'ROOT',
      body: { maxSucursales: 3 },
    });
    expect((await me()).limites.sucursales.maximo).toBe(3);
    await c.api('PATCH', `/platform/planes/${basico.idPlan}`, {
      who: 'ROOT',
      body: { maxSucursales: 2 },
    });
    expect((await me()).limites.sucursales.maximo).toBe(2);
  });
});
