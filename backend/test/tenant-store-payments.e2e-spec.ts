/**
 * Pruebas E2E de los medios de pago de la tienda online (P2c, todos los planes).
 *
 * La clienta de Urban Step compra desde su carrito y paga con los medios que su tienda acepta:
 * QR / transferencia con comprobante que verifica el personal, efectivo al retirar, y tarjeta
 * (pasarela simulada y webhook de Stripe firmado). Aprobar confirma la venta y descuenta stock.
 * Al terminar se restaura la configuración y el stock tocado.
 * Ejecutar: npm run test:e2e:tenant
 */
import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import {
  DEMO_PASSWORD,
  DEMO_SLUG,
  WEBHOOK_SECRET_E2E,
  assertRlsApplies,
  client,
  startBackend,
  Backend,
} from './support/backend';

let backend: Backend;
let c: ReturnType<typeof client>;
let centro: number;
let variante: number;
let inventario: number;
let stockOriginal: number;
/** Configuración que tenía la tienda antes de las pruebas (se restaura al final). */
let configOriginal: Record<string, unknown>;
let qrOriginal: { mime: string; base64: string } | null = null;
const TEXTOS = [
  'banco',
  'titular',
  'numeroCuenta',
  'tipoCuenta',
  'documentoTitular',
  'instrucciones',
];
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF',
).toString('base64');
const stripe = new Stripe('sk_test_solo_para_firmar');

const stock = async () =>
  (await c.api('GET', '/inventory/inventarios', { who: 'B' })).body.find(
    (i: any) => i.idInventario === inventario,
  ).stockDisponible;
const ponerStock = (n: number) =>
  c.api('PATCH', `/inventory/inventarios/${inventario}`, {
    who: 'B',
    body: { stockDisponible: n },
  });
const config = (body: object, who = 'B') =>
  c.api('PUT', '/payments/config', { who, body });

/** La clienta compra 1 unidad desde su carrito: venta DIGITAL PENDIENTE. */
async function comprar() {
  const item = await c.api('POST', '/cart/items', {
    who: 'CLI',
    body: { idSucursal: centro, idVariante: variante, cantidad: 1 },
  });
  expect(item.status).toBe(201);
  const v = await c.api('POST', '/sales/from-cart', {
    who: 'CLI',
    body: { idSucursal: centro, clientRequestId: randomUUID() },
  });
  expect(v.status).toBe(201);
  expect(v.body).toMatchObject({ estado: 'PENDIENTE', tipoVenta: 'DIGITAL' });
  return v.body as { idVenta: number; total: string | number };
}
const pagar = (
  venta: { idVenta: number; total: string | number },
  metodo: string,
) =>
  c.api('POST', '/payments', {
    who: 'CLI',
    body: {
      idVenta: venta.idVenta,
      metodo,
      monto: Number(venta.total),
      clientRequestId: randomUUID(),
    },
  });
const estadoVenta = async (idVenta: number) =>
  (await c.api('GET', '/sales/me', { who: 'CLI' })).body.find(
    (v: any) => v.idVenta === idVenta,
  )?.estado;

async function webhookVenta(idPago: number, montoMinimo: number) {
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
  return { status: res.status, body: await res.json() };
}

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
    ['ENC', 'encargado.centro@urbanstep.demo'],
    ['CLI', 'cliente@urbanstep.demo'],
  ])
    await c.login(who, { email, password: DEMO_PASSWORD, empresa: DEMO_SLUG });

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

  // Se parte de la configuración por defecto, guardando la original para restaurarla.
  configOriginal = (await c.api('GET', '/payments/config', { who: 'B' })).body;
  if (configOriginal.qrSubido) {
    const r = await fetch(`${backend.base}/payments/config/qr`, {
      headers: { authorization: `Bearer ${c.tokens.B}` },
    });
    qrOriginal = {
      mime: r.headers.get('content-type')!,
      base64: Buffer.from(await r.arrayBuffer()).toString('base64'),
    };
  }
  await config({ tarjeta: true, efectivoRetiro: true });
  await c.api('DELETE', '/payments/config/qr', { who: 'B' });
  await config({
    qr: false,
    transferencia: false,
    contraentrega: false,
    ...Object.fromEntries(TEXTOS.map((k) => [k, ''])),
  });
}, 60_000);

afterAll(async () => {
  if (qrOriginal)
    await c.api('PUT', '/payments/config/qr', {
      who: 'B',
      body: { mime: qrOriginal.mime, archivoBase64: qrOriginal.base64 },
    });
  else await c.api('DELETE', '/payments/config/qr', { who: 'B' });
  const original = Object.fromEntries(
    [
      'tarjeta',
      'qr',
      'transferencia',
      'efectivoRetiro',
      'contraentrega',
      ...TEXTOS,
    ].map((k) => [k, configOriginal[k] ?? '']),
  );
  await config(original);
  await ponerStock(stockOriginal);
  backend?.stop();
});

describe('Medios de pago de la tienda (e2e)', () => {
  it('configuración por defecto: tarjeta y efectivo al retirar; solo el ADMIN la cambia', async () => {
    const r = await c.api('GET', '/payments/config', { who: 'B' });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      tarjeta: true,
      efectivoRetiro: true,
      proveedorTarjeta: 'SIMULADO',
    });
    expect(r.body.qrImagen).toBeUndefined();
    expect(
      (await c.api('GET', '/payments/config', { who: 'ENC' })).status,
    ).toBe(403);
    expect((await config({ contraentrega: true }, 'ENC')).status).toBe(403);
  });

  it('valida la configuración: QR sin imagen, transferencia sin cuenta, todo apagado', async () => {
    expect(
      (await c.api('GET', '/payments/config', { who: 'B' })).body.qrSubido,
    ).toBe(false);
    expect((await config({ qr: true })).body.message).toMatch(
      /sube la imagen de tu QR/,
    );
    expect((await config({ transferencia: true })).body.message).toMatch(
      /banco, titular y número de cuenta/,
    );
    expect(
      (await config({ tarjeta: false, efectivoRetiro: false })).body.message,
    ).toMatch(/al menos un medio/);
  });

  it('el QR se valida por su contenido (no basta con decir que es PNG) y queda disponible para la clienta', async () => {
    const falso = await c.api('PUT', '/payments/config/qr', {
      who: 'B',
      body: {
        mime: 'image/png',
        archivoBase64: Buffer.from('no soy una imagen').toString('base64'),
      },
    });
    expect(falso.status).toBe(400);
    expect(
      (
        await c.api('PUT', '/payments/config/qr', {
          who: 'B',
          body: { mime: 'image/gif', archivoBase64: PNG },
        })
      ).status,
    ).toBe(400);
    const ok = await c.api('PUT', '/payments/config/qr', {
      who: 'B',
      body: {
        mime: 'image/png',
        archivoBase64: `data:image/png;base64,${PNG}`,
      },
    });
    expect(ok.body.qrSubido).toBe(true);

    const r = await config({
      qr: true,
      transferencia: true,
      contraentrega: false,
      banco: 'Banco Unión',
      titular: 'Urban Step SRL',
      numeroCuenta: '1000-2000-30',
      tipoCuenta: 'Caja de ahorro',
    });
    expect(r.status).toBe(200);
    const metodos = (await c.api('GET', '/payments/metodos', { who: 'CLI' }))
      .body;
    expect(metodos).toMatchObject({
      moneda: 'BOB',
      tarjeta: true,
      qr: true,
      transferencia: true,
      efectivoRetiro: true,
      contraentrega: false,
      cuenta: { banco: 'Banco Unión', numeroCuenta: '1000-2000-30' },
    });
    const img = await fetch(`${backend.base}/payments/config/qr`, {
      headers: { authorization: `Bearer ${c.tokens.CLI}` },
    });
    expect(img.headers.get('content-type')).toBe('image/png');
    expect(
      Buffer.from(await img.arrayBuffer()).equals(Buffer.from(PNG, 'base64')),
    ).toBe(true);
  });

  it('quitar el QR desactiva el pago por QR', async () => {
    const r = await c.api('DELETE', '/payments/config/qr', { who: 'B' });
    expect(r.body).toMatchObject({ qrSubido: false, qr: false });
    expect(
      (await c.api('GET', '/payments/metodos', { who: 'CLI' })).body.qr,
    ).toBe(false);
    expect(
      (await c.api('DELETE', '/payments/config/qr', { who: 'ENC' })).status,
    ).toBe(403);
    await c.api('PUT', '/payments/config/qr', {
      who: 'B',
      body: { mime: 'image/png', archivoBase64: PNG },
    });
    expect((await config({ qr: true })).body.qr).toBe(true);
  });

  it('la clienta no puede usar un medio desactivado ni registrar tarjeta a mano', async () => {
    const v = await comprar();
    expect((await pagar(v, 'CONTRAPAGO')).body.message).toMatch(
      /no acepta ese medio/,
    );
    expect((await pagar(v, 'TARJETA')).body.message).toMatch(
      /Pagar con tarjeta/,
    );
  });

  it('QR: comprobante validado, el personal lo ve, lo aprueba y la venta se confirma descontando stock', async () => {
    const antes = await stock();
    const v = await comprar();
    const pago = (await pagar(v, 'QR')).body;
    expect(pago).toMatchObject({ metodo: 'QR', estado: 'PENDIENTE' });

    const subir = (body: object, who = 'CLI') =>
      c.api('POST', `/payments/${pago.idPago}/comprobante`, { who, body });
    expect(
      (await subir({ mime: 'application/pdf', archivoBase64: PNG })).status,
    ).toBe(400);
    const grande = Buffer.concat([
      Buffer.from('%PDF-1.4\n'),
      Buffer.alloc(3 * 1024 * 1024 + 10),
    ]).toString('base64');
    expect(
      (await subir({ mime: 'application/pdf', archivoBase64: grande })).body
        .message,
    ).toMatch(/máximo es 3.0 MB/);
    expect(
      (
        await subir({
          mime: 'application/pdf',
          archivoBase64: PDF,
          nombre: 'voucher.pdf',
        })
      ).status,
    ).toBe(201);

    // Otra empresa no lo ve (RLS) y el personal de Urban Step sí.
    expect(
      (await c.api('GET', `/payments/${pago.idPago}/comprobante`, { who: 'A' }))
        .status,
    ).toBe(404);
    const lista = (
      await c.api('GET', '/payments/por-verificar', { who: 'ENC' })
    ).body;
    expect(lista.find((p: any) => p.idPago === pago.idPago)).toMatchObject({
      metodo: 'QR',
      comprobante: { mime: 'application/pdf' },
      venta: { idVenta: v.idVenta },
    });
    const archivo = await fetch(
      `${backend.base}/payments/${pago.idPago}/comprobante`,
      { headers: { authorization: `Bearer ${c.tokens.ENC}` } },
    );
    expect(archivo.headers.get('content-type')).toBe('application/pdf');
    expect(archivo.headers.get('x-content-type-options')).toBe('nosniff');

    expect(
      (
        await c.api('PATCH', `/payments/${pago.idPago}/estado`, {
          who: 'CLI',
          body: { estado: 'APROBADO' },
        })
      ).status,
    ).toBe(403);
    const ok = await c.api('PATCH', `/payments/${pago.idPago}/estado`, {
      who: 'ENC',
      body: { estado: 'APROBADO' },
    });
    expect(ok.body.estado).toBe('APROBADO');
    expect(await estadoVenta(v.idVenta)).toBe('PAGADA');
    expect(await stock()).toBe(antes - 1);
    expect(
      (await subir({ mime: 'application/pdf', archivoBase64: PDF })).status,
    ).toBe(400);
  });

  it('transferencia rechazada: la venta sigue pendiente y no se descuenta stock', async () => {
    const antes = await stock();
    const v = await comprar();
    const pago = (await pagar(v, 'TRANSFERENCIA')).body;
    await c.api('POST', `/payments/${pago.idPago}/comprobante`, {
      who: 'CLI',
      body: { mime: 'image/png', archivoBase64: PNG },
    });
    expect(
      (
        await c.api('PATCH', `/payments/${pago.idPago}/estado`, {
          who: 'B',
          body: { estado: 'RECHAZADO' },
        })
      ).body.estado,
    ).toBe('RECHAZADO');
    expect(await estadoVenta(v.idVenta)).toBe('PENDIENTE');
    expect(await stock()).toBe(antes);
  });

  it('si la clienta cambia de medio, el intento anterior pendiente queda anulado', async () => {
    const v = await comprar();
    const qr = (await pagar(v, 'QR')).body;
    const efectivo = (await pagar(v, 'EFECTIVO')).body;
    const pagos = (
      await c.api('GET', `/payments/venta/${v.idVenta}`, { who: 'CLI' })
    ).body;
    expect(pagos.find((p: any) => p.idPago === qr.idPago).estado).toBe(
      'ANULADO',
    );
    expect(pagos.find((p: any) => p.idPago === efectivo.idPago).estado).toBe(
      'PENDIENTE',
    );
    // Efectivo al retirar: aparece para cobrar en la sucursal, sin comprobante.
    const lista = (
      await c.api('GET', '/payments/por-verificar', { who: 'ENC' })
    ).body;
    expect(lista.find((p: any) => p.idPago === efectivo.idPago)).toMatchObject({
      metodo: 'EFECTIVO',
      comprobante: null,
    });
    await c.api('PATCH', `/payments/${efectivo.idPago}/estado`, {
      who: 'ENC',
      body: { estado: 'RECHAZADO' },
    });
  });

  it('tarjeta (pasarela simulada): solo la dueña paga y la venta queda pagada', async () => {
    const v = await comprar();
    expect(
      (
        await c.api('POST', `/payments/venta/${v.idVenta}/tarjeta`, {
          who: 'B',
        })
      ).status,
    ).toBe(403);
    const r = await c.api('POST', `/payments/venta/${v.idVenta}/tarjeta`, {
      who: 'CLI',
    });
    expect(r.status).toBe(201);
    expect(r.body.url).toContain(
      `/t/${DEMO_SLUG}/compra/${v.idVenta}?simulado=${r.body.idPago}`,
    );
    const pagado = await c.api(
      'POST',
      `/payments/${r.body.idPago}/simulado/pagar`,
      { who: 'CLI' },
    );
    expect(pagado.body).toMatchObject({
      resultado: 'aprobado',
      pago: { estado: 'APROBADO' },
    });
    expect(await estadoVenta(v.idVenta)).toBe('PAGADA');
  });

  it('webhook de Stripe para ventas: aprueba una vez, rechaza montos alterados', async () => {
    const v = await comprar();
    const { idPago } = (
      await c.api('POST', `/payments/venta/${v.idVenta}/tarjeta`, {
        who: 'CLI',
      })
    ).body;
    const centavos = Math.round(Number(v.total) * 100);
    expect((await webhookVenta(idPago, centavos + 50)).body.accion).toBe(
      'monto_distinto',
    );
    expect(await estadoVenta(v.idVenta)).toBe('PENDIENTE');
    expect((await webhookVenta(idPago, centavos)).body).toEqual({
      recibido: true,
      accion: 'aprobado',
    });
    expect((await webhookVenta(idPago, centavos)).body.accion).toBe(
      'ya_procesado',
    );
    expect(await estadoVenta(v.idVenta)).toBe('PAGADA');
  });

  it('si se pagó pero la prenda se agotó mientras tanto, el pago se rechaza y se reembolsa', async () => {
    const v = await comprar();
    const { idPago } = (
      await c.api('POST', `/payments/venta/${v.idVenta}/tarjeta`, {
        who: 'CLI',
      })
    ).body;
    const antes = await stock();
    await ponerStock(0);
    expect(
      (await webhookVenta(idPago, Math.round(Number(v.total) * 100))).body
        .accion,
    ).toBe('reembolsado');
    expect(
      (await c.api('GET', `/payments/${idPago}`, { who: 'CLI' })).body.estado,
    ).toBe('RECHAZADO');
    expect(await estadoVenta(v.idVenta)).toBe('PENDIENTE');
    await ponerStock(antes);
  });

  it('el antiguo simulador público ya no existe (aprobaba pagos sin autenticación)', async () => {
    const r = await fetch(`${backend.base}/mock-gateway/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idPago: 1, resultado: 'APROBADO' }),
    });
    expect(r.status).toBe(404);
  });
});
