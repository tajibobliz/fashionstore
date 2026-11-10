/**
 * Pruebas E2E del pago diferido de pedidos hechos sin conexión (P2 / CU16, plan Empresarial).
 *
 * La clienta de Urban Step hace un pedido sin internet (operación ORDEN_PAGO_DIFERIDO). Al
 * sincronizar, el servidor valida plan, stock y precio y crea la venta pendiente de pago con un
 * plazo; la clienta paga después (tarjeta o los medios de su tienda). Se prueban: el plan, el
 * stock (conflicto con alternativas), el precio (aceptar el nuevo total), el cobro, la
 * idempotencia, el vencimiento y el reembolso si llega un cobro de un pedido ya cancelado.
 * Al terminar se restaura el plan, el vencimiento y el stock de Urban Step.
 * Ejecutar: npm run test:e2e:tenant
 */
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
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
let idB: number;
let vencimientoOriginal: string;
let centro: number;
let variante: number;
let inventario: number;
let stockOriginal: number;
let precio: number;
/** Segunda prenda, para el pedido del carrito offline (CU15). */
let segunda: {
  idVariante: number;
  idInventario: number;
  stockOriginal: number;
};
const stripe = new Stripe('sk_test_solo_para_firmar');

const plan = (codigoPlan: string) =>
  c.api('POST', `/platform/empresas/${idB}/suscripcion`, {
    who: 'ROOT',
    body: { codigoPlan },
  });
const ponerStock = (n: number) =>
  c.api('PATCH', `/inventory/inventarios/${inventario}`, {
    who: 'B',
    body: { stockDisponible: n },
  });
const pedido = (over: { precio?: number; cantidad?: number } = {}) => ({
  operationId: randomUUID(),
  type: 'ORDEN_PAGO_DIFERIDO',
  idSucursal: centro,
  createdAtLocal: new Date().toISOString(),
  payload: {
    detalles: [
      {
        idVariante: variante,
        cantidad: over.cantidad ?? 1,
        precioUnitario: over.precio ?? precio,
      },
    ],
  },
});
const sync = async (who: string, ...operations: object[]) => {
  const r = await c.api('POST', '/sync/operations', {
    who,
    body: { deviceId: `e2e-diferido-${who}`, operations },
  });
  expect(r.status).toBe(200);
  return r.body.results as any[];
};
const venta = async (id: number) =>
  (await c.api('GET', `/sales/${id}`, { who: 'CLI' })).body;
/** Consulta directa a la base (sin empresa fijada en la sesión, la política RLS deja ver todo). */
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
async function webhook(idPago: number, montoMinimo: number) {
  const payload = JSON.stringify({
    id: `evt_${randomUUID()}`,
    object: 'event',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: `cs_test_${idPago}`,
        object: 'checkout.session',
        payment_status: 'paid',
        payment_intent: `pi_${randomUUID()}`,
        amount_total: montoMinimo,
        metadata: {
          app: 'fashionstore',
          tipo: 'venta',
          idPago: String(idPago),
        },
      },
    },
  });
  const res = await fetch(`${backend.base}/billing/stripe/webhook`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': stripe.webhooks.generateTestHeaderString({
        payload,
        secret: WEBHOOK_SECRET_E2E,
      }),
    },
    body: payload,
  });
  return (await res.json()) as { accion: string };
}

beforeAll(async () => {
  await assertRlsApplies();
  backend = await startBackend();
  c = client(backend.base);
  await c.login('ROOT', { email: ROOT_EMAIL, password: ROOT_PASSWORD });
  for (const [who, email] of [
    ['B', 'admin@urbanstep.demo'],
    ['ENC', 'encargado.centro@urbanstep.demo'],
    ['CLI', 'cliente@urbanstep.demo'],
  ])
    await c.login(who, { email, password: DEMO_PASSWORD, empresa: DEMO_SLUG });
  idB = c.tid('B');
  vencimientoOriginal = (
    await c.api('GET', `/platform/empresas/${idB}`, { who: 'ROOT' })
  ).body.suscripcion.fechaVencimiento;

  const sucursales = (await c.api('GET', '/branches/sucursales', { who: 'B' }))
    .body;
  centro = sucursales.find(
    (s: any) => s.nombre === 'Urban Step Centro',
  ).idSucursal;
  const inv = (
    await c.api('GET', '/inventory/inventarios', { who: 'B' })
  ).body.filter(
    (i: any) =>
      i.sucursal.idSucursal === centro && i.almacen?.codigo === 'PRINCIPAL',
  );
  const elegido = inv.sort(
    (a: any, b: any) => b.stockDisponible - a.stockDisponible,
  )[0];
  variante = elegido.variante.idVariante;
  inventario = elegido.idInventario;
  stockOriginal = elegido.stockDisponible;
  await ponerStock(20);
  const otra = inv[1];
  segunda = {
    idVariante: otra.variante.idVariante,
    idInventario: otra.idInventario,
    stockOriginal: otra.stockDisponible,
  };
  await c.api('PATCH', `/inventory/inventarios/${segunda.idInventario}`, {
    who: 'B',
    body: { stockDisponible: 5 },
  });
}, 60_000);

afterAll(async () => {
  if (idB && vencimientoOriginal) {
    await plan('BASICO');
    await c.api('PATCH', `/platform/empresas/${idB}/suscripcion/vencimiento`, {
      who: 'ROOT',
      body: { fechaVencimiento: vencimientoOriginal },
    });
  }
  if (inventario) await ponerStock(stockOriginal);
  if (segunda)
    await c.api('PATCH', `/inventory/inventarios/${segunda.idInventario}`, {
      who: 'B',
      body: { stockDisponible: segunda.stockOriginal },
    });
  backend?.stop();
});

describe('Pago diferido de pedidos offline (e2e)', () => {
  it('en el plan Básico la tienda offline solo reserva: el pedido se rechaza', async () => {
    await plan('BASICO');
    const cat = (
      await c.api('GET', `/sync/catalog?sucursal=${centro}`, { who: 'CLI' })
    ).body;
    expect(cat.tienda).toMatchObject({ moneda: 'BOB', pagoDiferido: false });
    precio = cat.productos.find((p: any) =>
      p.variantes.some((v: any) => v.idVariante === variante),
    ).precioFinal;
    const [r] = await sync('CLI', pedido());
    expect(r).toMatchObject({ status: 'RECHAZADA', serverId: null });
    expect(r.reason).toMatch(/no incluye esta funcionalidad/);
  });

  it('en Empresarial el catálogo offline lo habilita y el personal no puede hacer pedidos', async () => {
    await plan('EMPRESARIAL');
    const cat = (
      await c.api('GET', `/sync/catalog?sucursal=${centro}`, { who: 'CLI' })
    ).body;
    expect(cat.tienda).toMatchObject({
      moneda: 'BOB',
      pagoDiferido: true,
      horasParaPagar: 48,
    });
    const [r] = await sync('ENC', pedido());
    expect(r.status).toBe('RECHAZADA');
    expect(r.reason).toMatch(/Solo la clienta/);
  });

  it('el pedido se registra pendiente de pago con plazo, sin descontar stock, y es idempotente', async () => {
    const op = pedido();
    const [r] = await sync('CLI', op);
    expect(r).toMatchObject({ status: 'CONFIRMADA', duplicada: false });
    const v = await venta(r.serverId);
    expect(v).toMatchObject({
      estado: 'PENDIENTE',
      tipoVenta: 'DIGITAL',
      pagoDiferido: true,
    });
    expect(Number(v.total)).toBeCloseTo(precio, 2);
    const horas = (Date.parse(v.pagoVenceEn) - Date.now()) / 3_600_000;
    expect(horas).toBeGreaterThan(47.9);
    expect(horas).toBeLessThanOrEqual(48);
    const inv = (await c.api('GET', '/inventory/inventarios', { who: 'B' }))
      .body;
    expect(
      inv.find((i: any) => i.idInventario === inventario).stockDisponible,
    ).toBe(20);

    const [otra] = await sync('CLI', op);
    expect(otra).toMatchObject({ duplicada: true, serverId: r.serverId });
  });

  it('se paga con tarjeta: el webhook confirma la venta y descuenta el stock', async () => {
    const [r] = await sync('CLI', pedido());
    const t = await c.api('POST', `/payments/venta/${r.serverId}/tarjeta`, {
      who: 'CLI',
    });
    expect(t.status).toBe(201);
    expect(t.body.url).toContain(`/compra/${r.serverId}`);
    expect(
      (await webhook(t.body.idPago, Math.round(precio * 100))).accion,
    ).toBe('aprobado');
    expect((await venta(r.serverId)).estado).toBe('PAGADA');
    const inv = (await c.api('GET', '/inventory/inventarios', { who: 'B' }))
      .body;
    expect(
      inv.find((i: any) => i.idInventario === inventario).stockDisponible,
    ).toBe(19);
  });

  it('carrito offline (CU15): un pedido con varias prendas se registra completo o no se registra', async () => {
    const cat = (
      await c.api('GET', `/sync/catalog?sucursal=${centro}`, { who: 'CLI' })
    ).body;
    const precio2 = cat.productos.find((p: any) =>
      p.variantes.some((v: any) => v.idVariante === segunda.idVariante),
    ).precioFinal;
    const carrito = (cantidad2: number) => ({
      ...pedido(),
      payload: {
        detalles: [
          { idVariante: variante, cantidad: 2, precioUnitario: precio },
          {
            idVariante: segunda.idVariante,
            cantidad: cantidad2,
            precioUnitario: precio2,
          },
        ],
      },
    });

    const [ok] = await sync('CLI', carrito(1));
    expect(ok.status).toBe('CONFIRMADA');
    const v = await venta(ok.serverId);
    expect(v.detalles).toHaveLength(2);
    expect(Number(v.total)).toBeCloseTo(2 * precio + precio2, 2);
    expect(Number(v.totalEstimado)).toBeCloseTo(2 * precio + precio2, 2);
    await c.api('PATCH', `/sales/${ok.serverId}/cancelar`, { who: 'CLI' });

    // Falta stock de una sola prenda: no se registra nada (todo o nada).
    const [mal] = await sync('CLI', carrito(6));
    expect(mal).toMatchObject({
      status: 'CONFLICTO',
      serverId: null,
      conflictos: ['SIN_STOCK'],
    });
    expect(mal.reason).toMatch(
      new RegExp(`variante ${segunda.idVariante}: quedan 5`),
    );
  });

  it('si ya no hay stock central el pedido no se crea y se ofrecen otras sucursales', async () => {
    const [r] = await sync('CLI', pedido({ cantidad: 25 }));
    expect(r).toMatchObject({
      status: 'CONFLICTO',
      serverId: null,
      conflictos: ['SIN_STOCK'],
    });
    expect(r.reason).toMatch(/quedan 19/);
    expect(Array.isArray(r.alternativas)).toBe(true);
  });

  it('si el precio cambió, cobra el vigente y exige aceptar el nuevo total antes de pagar', async () => {
    const [r] = await sync('CLI', pedido({ precio: precio - 5 }));
    expect(r).toMatchObject({ status: 'CONFLICTO', conflictos: ['PRECIO'] });
    expect(r.serverId).toEqual(expect.any(Number));
    expect(r.reason).toMatch(/nuevo total es/);
    const v = await venta(r.serverId);
    expect(Number(v.totalEstimado)).toBeCloseTo(precio - 5, 2);
    expect(Number(v.total)).toBeCloseTo(precio, 2);

    const pagar = await c.api('POST', `/payments/venta/${r.serverId}/tarjeta`, {
      who: 'CLI',
    });
    expect(pagar.body.message).toMatch(/acepta el nuevo total/);
    const qr = await c.api('POST', '/payments', {
      who: 'CLI',
      body: {
        idVenta: r.serverId,
        metodo: 'EFECTIVO',
        monto: precio,
        clientRequestId: randomUUID(),
      },
    });
    expect(qr.body.message).toMatch(/acepta el nuevo total/);

    expect(
      (await c.api('PATCH', `/sales/${r.serverId}/aceptar-total`, { who: 'B' }))
        .status,
    ).toBe(403);
    const ok = await c.api('PATCH', `/sales/${r.serverId}/aceptar-total`, {
      who: 'CLI',
    });
    expect(Number(ok.body.totalEstimado)).toBeCloseTo(precio, 2);
    expect(
      (
        await c.api('POST', `/payments/venta/${r.serverId}/tarjeta`, {
          who: 'CLI',
        })
      ).status,
    ).toBe(201);
    await c.api('PATCH', `/sales/${r.serverId}/cancelar`, { who: 'CLI' });
  });

  it('vencido el plazo no se puede pagar: el pedido se cancela y anula sus pagos', async () => {
    const [r] = await sync('CLI', pedido());
    const efectivo = await c.api('POST', '/payments', {
      who: 'CLI',
      body: {
        idVenta: r.serverId,
        metodo: 'EFECTIVO',
        monto: precio,
        clientRequestId: randomUUID(),
      },
    });
    expect(efectivo.status).toBe(201);
    await sql(
      `UPDATE venta SET pago_vence_en = now() - interval '1 minute' WHERE id_venta = $1`,
      [r.serverId],
    );
    const pagar = await c.api('POST', `/payments/venta/${r.serverId}/tarjeta`, {
      who: 'CLI',
    });
    expect(pagar.status).toBe(400);
    expect(pagar.body.message).toMatch(/plazo para pagar este pedido venció/);
    expect((await venta(r.serverId)).estado).toBe('CANCELADA');
    const [p] = await sql(`SELECT estado FROM pago WHERE id_pago = $1`, [
      efectivo.body.idPago,
    ]);
    expect(p.estado).toBe('ANULADO');
  });

  it('si el cobro de Stripe llega cuando el pedido ya venció y se canceló, se reembolsa', async () => {
    const [r] = await sync('CLI', pedido());
    const { idPago } = (
      await c.api('POST', `/payments/venta/${r.serverId}/tarjeta`, {
        who: 'CLI',
      })
    ).body;
    // La tarea programada lo canceló mientras la clienta estaba en la página de Stripe.
    await sql(`UPDATE venta SET estado = 'CANCELADA' WHERE id_venta = $1`, [
      r.serverId,
    ]);
    await sql(`UPDATE pago SET estado = 'ANULADO' WHERE id_pago = $1`, [
      idPago,
    ]);
    expect((await webhook(idPago, Math.round(precio * 100))).accion).toBe(
      'reembolsado',
    );
    expect((await venta(r.serverId)).estado).toBe('CANCELADA');
  });

  it('con la suscripción vencida el lote queda pendiente en el dispositivo (403)', async () => {
    await c.api('PATCH', `/platform/empresas/${idB}/suscripcion/vencimiento`, {
      who: 'ROOT',
      body: { fechaVencimiento: '2020-01-01' },
    });
    const r = await c.api('POST', '/sync/operations', {
      who: 'CLI',
      body: { deviceId: 'e2e-diferido-CLI', operations: [pedido()] },
    });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('SUSCRIPCION_VENCIDA');
    await plan('EMPRESARIAL');
  });
});
