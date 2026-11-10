/**
 * Pruebas E2E del pago de la suscripción (planes en USD con Stripe Checkout).
 *
 * El backend arranca con la pasarela SIMULADA (no se cobra nada) y con un secreto de webhook
 * de prueba: los avisos de Stripe se firman aquí mismo con el SDK oficial, así se prueba la
 * verificación de la firma y el procesamiento real sin conexión a Stripe.
 * Ejecutar: npm run test:e2e:tenant
 */
import Stripe from 'stripe';
import {
  DEMO_PASSWORD,
  DEMO_SLUG,
  ROOT_EMAIL,
  ROOT_PASSWORD,
  WEBHOOK_SECRET_E2E,
  assertRlsApplies,
  client,
  startBackend,
  Backend,
} from './support/backend';

let backend: Backend;
let c: ReturnType<typeof client>;
const slug = `cobro-${Date.now()}`;
const stripe = new Stripe('sk_test_solo_para_firmar');

const me = (who = 'T') =>
  c.api('GET', '/tenant/me', { who }).then((r) => r.body);
const checkout = (codigoPlan: string, meses?: number, who = 'T') =>
  c.api('POST', '/billing/checkout', {
    who,
    body: { codigoPlan, ...(meses ? { meses } : {}) },
  });
const pagar = (ref: string, who = 'T') =>
  c.api('POST', `/billing/simulado/${ref}/pagar`, { who });
const sumarMeses = (fecha: string, meses: number) => {
  const d = new Date(`${fecha}T00:00:00`);
  d.setMonth(d.getMonth() + meses);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Envía un evento a /billing/stripe/webhook firmado como lo hace Stripe. */
async function webhook(
  evento: object,
  opciones: { firma?: string | null } = {},
) {
  const payload = JSON.stringify(evento);
  const firma =
    opciones.firma === undefined
      ? stripe.webhooks.generateTestHeaderString({
          payload,
          secret: WEBHOOK_SECRET_E2E,
        })
      : opciones.firma;
  const res = await fetch(`${backend.base}/billing/stripe/webhook`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(firma ? { 'stripe-signature': firma } : {}),
    },
    body: payload,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}
const sesionCompletada = (
  id: string,
  amount: number,
  app = 'fashionstore',
  tipo = 'checkout.session.completed',
) => ({
  id: `evt_${Math.random().toString(36).slice(2)}`,
  object: 'event',
  type: tipo,
  data: {
    object: {
      id,
      object: 'checkout.session',
      payment_status: 'paid',
      payment_intent: `pi_${Math.random().toString(36).slice(2)}`,
      amount_total: amount,
      metadata: { app },
    },
  },
});

beforeAll(async () => {
  await assertRlsApplies();
  backend = await startBackend();
  c = client(backend.base);
  await c.login('ENC', {
    email: 'encargado.centro@urbanstep.demo',
    password: DEMO_PASSWORD,
    empresa: DEMO_SLUG,
  });
  await c.login('ROOT', {
    email: ROOT_EMAIL,
    password: ROOT_PASSWORD,
  });
  const r = await c.api('POST', '/saas/registro', {
    body: {
      nombre: 'Tienda Cobro E2E',
      slug,
      codigoPlan: 'BASICO',
      admin: {
        nombre: 'Bea',
        email: `bea@${slug}.demo`,
        password: 'e2e-clave',
      },
    },
  });
  expect(r.status).toBe(201);
  c.tokens.T = r.body.access_token;
  c.tokens.REF_REGISTRO = r.body.checkout.referencia;
}, 60_000);

afterAll(() => backend?.stop());

describe('Pago de la suscripción (e2e)', () => {
  it('al registrarse queda un pago pendiente en USD y la tienda sin plan hasta pagar', async () => {
    const pago = (
      await c.api('GET', `/billing/pagos/${c.tokens.REF_REGISTRO}`, {
        who: 'T',
      })
    ).body;
    const planes = (await c.api('GET', '/saas/planes')).body;
    const basico = planes.find((p: any) => p.codigo === 'BASICO');
    expect(pago).toMatchObject({
      estado: 'PENDIENTE',
      proveedor: 'SIMULADO',
      codigoPlan: 'BASICO',
      meses: 1,
      moneda: 'USD',
      monto: basico.precioReferencia,
    });
    expect((await me()).suscripcion.estado).toBe('SIN_SUSCRIPCION');
    // Sin plan: solo lectura.
    const escribir = await c.api('POST', '/catalog/categorias', {
      who: 'T',
      body: { nombre: 'Cat' },
    });
    expect(escribir.status).toBe(403);
  });

  it('pagar activa el plan por un mes; pagar otra vez no duplica nada (idempotencia)', async () => {
    const r = await pagar(c.tokens.REF_REGISTRO);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ estado: 'PAGADO' });
    const hoy = (await me()).suscripcion.fechaInicio;
    expect(await me()).toMatchObject({
      plan: { codigo: 'BASICO' },
      suscripcion: { estado: 'ACTIVA', fechaVencimiento: sumarMeses(hoy, 1) },
    });
    const antes = (await c.api('GET', '/tenant/suscripciones', { who: 'T' }))
      .body.length;
    expect((await pagar(c.tokens.REF_REGISTRO)).body.estado).toBe('PAGADO');
    expect(
      (await c.api('GET', '/tenant/suscripciones', { who: 'T' })).body.length,
    ).toBe(antes);
  });

  it('renovar el mismo plan suma los meses al vencimiento actual; cambiar de plan empieza hoy', async () => {
    const vence = (await me()).suscripcion.fechaVencimiento;
    const ren = await checkout('BASICO', 2);
    expect(ren.status).toBe(201);
    await pagar(ren.body.referencia);
    expect((await me()).suscripcion.fechaVencimiento).toBe(
      sumarMeses(vence, 2),
    );

    const sube = await checkout('PROFESIONAL', 3);
    const pago = (
      await c.api('GET', `/billing/pagos/${sube.body.referencia}`, { who: 'T' })
    ).body;
    const planes = (await c.api('GET', '/saas/planes')).body;
    expect(pago.monto).toBeCloseTo(
      planes.find((p: any) => p.codigo === 'PROFESIONAL').precioReferencia * 3,
      2,
    );
    await pagar(sube.body.referencia);
    const ahora = await me();
    expect(ahora).toMatchObject({ plan: { codigo: 'PROFESIONAL' } });
    expect(ahora.suscripcion.fechaVencimiento).toBe(
      sumarMeses(ahora.suscripcion.fechaInicio, 3),
    );
  });

  it('cancelar deja el pago CANCELADO y ya no se puede pagar; el historial lo muestra', async () => {
    const r = await checkout('EMPRESARIAL');
    const cancelado = await c.api(
      'POST',
      `/billing/pagos/${r.body.referencia}/cancelar`,
      { who: 'T' },
    );
    expect(cancelado.body.estado).toBe('CANCELADO');
    expect((await pagar(r.body.referencia)).status).toBe(400);
    expect((await me()).plan.codigo).toBe('PROFESIONAL');
    const historial = (await c.api('GET', '/billing/pagos', { who: 'T' })).body;
    expect(historial[0]).toMatchObject({
      referencia: r.body.referencia,
      estado: 'CANCELADO',
    });
    expect(historial.filter((p: any) => p.estado === 'PAGADO')).toHaveLength(3);
  });

  it('solo el administrador paga, con planes y meses válidos; otra empresa no ve los pagos', async () => {
    expect((await checkout('BASICO', undefined, 'ENC')).status).toBe(403);
    expect((await checkout('ORO')).status).toBe(400);
    expect((await checkout('BASICO', 13)).status).toBe(400);
    expect(
      (
        await c.api('POST', '/billing/checkout', {
          who: 'ROOT',
          body: { codigoPlan: 'BASICO' },
        })
      ).status,
    ).toBe(403);
    await c.login('B', {
      email: 'admin@urbanstep.demo',
      password: DEMO_PASSWORD,
      empresa: DEMO_SLUG,
    });
    expect(
      (
        await c.api('GET', `/billing/pagos/${c.tokens.REF_REGISTRO}`, {
          who: 'B',
        })
      ).status,
    ).toBe(404);
    expect((await pagar(c.tokens.REF_REGISTRO, 'B')).status).toBe(404);
  });

  describe('webhook de Stripe', () => {
    it('rechaza avisos sin firma o con firma inválida', async () => {
      const evento = sesionCompletada('cs_test_falso', 100);
      expect((await webhook(evento, { firma: null })).status).toBe(400);
      expect(
        (await webhook(evento, { firma: 't=1,v1=firmafalsa' })).status,
      ).toBe(400);
    });

    it('ignora eventos de otros proyectos de la misma cuenta de Stripe', async () => {
      const r = await webhook(
        sesionCompletada('cs_test_otro_proyecto', 5000, 'recursos-humanos'),
      );
      expect(r).toEqual({
        status: 200,
        body: { recibido: true, accion: 'ignorado' },
      });
    });

    it('checkout.session.completed activa el plan una sola vez aunque Stripe repita el aviso', async () => {
      const r = await checkout('EMPRESARIAL', 1);
      const { monto } = (
        await c.api('GET', `/billing/pagos/${r.body.referencia}`, { who: 'T' })
      ).body;
      const centavos = Math.round(monto * 100);
      // Monto alterado: no activa.
      expect(
        (await webhook(sesionCompletada(r.body.referencia, centavos + 1))).body
          .accion,
      ).toBe('monto_distinto');
      expect((await me()).plan.codigo).toBe('PROFESIONAL');

      const evento = sesionCompletada(r.body.referencia, centavos);
      expect((await webhook(evento)).body).toEqual({
        recibido: true,
        accion: 'activado',
      });
      expect((await webhook(evento)).body.accion).toBe('ya_procesado');
      expect(await me()).toMatchObject({
        plan: { codigo: 'EMPRESARIAL' },
        suscripcion: { estado: 'ACTIVA' },
      });
      expect(
        (
          await c.api('GET', `/billing/pagos/${r.body.referencia}`, {
            who: 'T',
          })
        ).body.estado,
      ).toBe('PAGADO');
    });

    it('checkout.session.expired marca el pago pendiente como EXPIRADO', async () => {
      const r = await checkout('BASICO');
      const exp = await webhook({
        ...sesionCompletada(
          r.body.referencia,
          0,
          'fashionstore',
          'checkout.session.expired',
        ),
      });
      expect(exp.body.accion).toBe('expirado');
      expect(
        (
          await c.api('GET', `/billing/pagos/${r.body.referencia}`, {
            who: 'T',
          })
        ).body.estado,
      ).toBe('EXPIRADO');
      expect((await me()).plan.codigo).toBe('EMPRESARIAL');
    });
  });

  it('una tienda vencida puede pagar la renovación y vuelve a operar', async () => {
    const { empresa } = await me();
    await c.api(
      'PATCH',
      `/platform/empresas/${empresa.idEmpresa}/suscripcion/vencimiento`,
      {
        who: 'ROOT',
        body: { fechaVencimiento: '2020-01-01' },
      },
    );
    expect((await me()).suscripcion.estado).toBe('VENCIDA');
    expect(
      (
        await c.api('POST', '/catalog/categorias', {
          who: 'T',
          body: { nombre: `Cat ${Date.now()}` },
        })
      ).status,
    ).toBe(403);
    const r = await checkout('EMPRESARIAL');
    expect(r.status).toBe(201);
    await pagar(r.body.referencia);
    expect((await me()).suscripcion.estado).toBe('ACTIVA');
    expect(
      (
        await c.api('POST', '/catalog/categorias', {
          who: 'T',
          body: { nombre: `Cat ${Date.now()}` },
        })
      ).status,
    ).toBe(201);
  });
});
