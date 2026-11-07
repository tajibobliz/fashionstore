/**
 * Pruebas E2E de traspasos entre sucursales (P1 — CU14, RF-025, RN-013) contra una BD real.
 *
 * Reglas: el stock sale del almacén de origen al enviar (EN_TRANSITO) y entra al destino al
 * recibir; lo que no llega queda como merma con su motivo; el origen puede cancelar mientras
 * está en tránsito (el stock vuelve). Quien envía opera el origen y quien recibe opera el
 * destino; otra empresa no ve ni toca nada. Al terminar se restaura el stock original.
 *
 * Requisitos: los mismos que tenant-isolation. Ejecutar: npm run test:e2e:tenant
 */
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
let centro: number;
let equipetrol: number;
let sucursalA: number;
/** Dos prendas con inventario en ambas sucursales; inv = id de inventario por sucursal. */
let P1: { idVariante: number; inv: Record<number, number> };
let P2: { idVariante: number; inv: Record<number, number> };
const original: Array<{ inv: number; stock: number }> = [];

const stock = async (idVariante: number) =>
  (await c.api('GET', '/transfers/stock', { who: 'B' })).body.variantes.find(
    (v: any) => v.idVariante === idVariante,
  ).stock as Record<number, number>;
const ponerStock = (inv: number, n: number) =>
  c.api('PATCH', `/inventory/inventarios/${inv}`, {
    who: 'B',
    body: { stockDisponible: n },
  });
/** Traspasos creados por la prueba: los que queden en tránsito se cancelan al final. */
const creados: number[] = [];
const enviar = async (who: string, body: object) => {
  const r = await c.api('POST', '/transfers', { who, body });
  if (r.status === 201) creados.push(r.body.idTraspaso);
  return r;
};
const recibir = (who: string, id: number, body: object) =>
  c.api('POST', `/transfers/${id}/recibir`, { who, body });
/** Recibe cada línea con la cantidad indicada (por defecto, todo lo enviado). */
const lineas = (t: any, cantidades?: number[]) =>
  t.detalles.map((d: any, i: number) => ({
    idDetalleTraspaso: d.idDetalleTraspaso,
    cantidadRecibida: cantidades ? cantidades[i] : d.cantidadEnviada,
  }));
const envioBasico = (cant1 = 3, cant2 = 2) => ({
  idSucursalOrigen: centro,
  idSucursalDestino: equipetrol,
  observacion: 'Prueba e2e',
  detalles: [
    { idVariante: P1.idVariante, cantidad: cant1 },
    { idVariante: P2.idVariante, cantidad: cant2 },
  ],
});

beforeAll(async () => {
  await assertRlsApplies();
  backend = await startBackend();
  c = client(backend.base);
  await c.login('A', {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });
  await c.login('B', {
    email: 'admin@urbanstep.demo',
    password: DEMO_PASSWORD,
    empresa: DEMO_SLUG,
  });
  await c.login('ENC', {
    email: 'encargado.centro@urbanstep.demo',
    password: DEMO_PASSWORD,
    empresa: DEMO_SLUG,
  });
  await c.login('CAJ', {
    email: 'cajero@urbanstep.demo',
    password: DEMO_PASSWORD,
    empresa: DEMO_SLUG,
  });

  const sucursales = (await c.api('GET', '/branches/sucursales', { who: 'B' }))
    .body;
  centro = sucursales.find(
    (s: any) => s.nombre === 'Urban Step Centro',
  ).idSucursal;
  equipetrol = sucursales.find(
    (s: any) => s.nombre === 'Urban Step Equipetrol',
  ).idSucursal;
  sucursalA = (await c.api('GET', '/branches/sucursales', { who: 'A' })).body[0]
    .idSucursal;

  // Dos variantes con inventario en el almacén principal de ambas sucursales.
  const inventarios = (
    await c.api('GET', '/inventory/inventarios', { who: 'B' })
  ).body.filter((i: any) => i.almacen?.codigo === 'PRINCIPAL');
  const porVariante = new Map<number, Record<number, number>>();
  for (const i of inventarios) {
    const m = porVariante.get(i.variante.idVariante) ?? {};
    m[i.sucursal.idSucursal] = i.idInventario;
    porVariante.set(i.variante.idVariante, m);
  }
  const ambas = [...porVariante.entries()].filter(
    ([, m]) => m[centro] && m[equipetrol],
  );
  expect(ambas.length).toBeGreaterThanOrEqual(2);
  P1 = { idVariante: ambas[0][0], inv: ambas[0][1] };
  P2 = { idVariante: ambas[1][0], inv: ambas[1][1] };

  // Stock conocido: Centro 10 y 6; Equipetrol 2 y 1 (se guarda el original para restaurarlo).
  for (const [p, valores] of [
    [P1, { [centro]: 10, [equipetrol]: 2 }],
    [P2, { [centro]: 6, [equipetrol]: 1 }],
  ] as const) {
    for (const suc of [centro, equipetrol]) {
      const inv = p.inv[suc];
      original.push({
        inv,
        stock: inventarios.find((i: any) => i.idInventario === inv)
          .stockDisponible,
      });
      expect((await ponerStock(inv, valores[suc])).status).toBe(200);
    }
  }
}, 120_000);

afterAll(async () => {
  for (const id of creados) {
    const t = await c.api('GET', `/transfers/${id}`, { who: 'B' });
    if (t.body?.estado === 'EN_TRANSITO')
      await c.api('POST', `/transfers/${id}/cancelar`, {
        who: 'B',
        body: { motivo: 'Limpieza e2e' },
      });
  }
  for (const o of original) await ponerStock(o.inv, o.stock);
  backend?.stop();
});

describe('Traspasos entre sucursales (e2e)', () => {
  it('muestra el stock por sucursal; el encargado de sucursal solo puede enviar desde la suya', async () => {
    const admin = await c.api('GET', '/transfers/stock', { who: 'B' });
    expect(admin.status).toBe(200);
    expect(admin.body.sucursales.map((s: any) => s.idSucursal).sort()).toEqual(
      [centro, equipetrol].sort(),
    );
    expect(admin.body.origenesPermitidos.sort()).toEqual(
      [centro, equipetrol].sort(),
    );
    expect(await stock(P1.idVariante)).toMatchObject({
      [centro]: 10,
      [equipetrol]: 2,
    });

    const enc = await c.api('GET', '/transfers/stock', { who: 'ENC' });
    expect(enc.body.origenesPermitidos).toEqual([centro]);
    expect(
      (await c.api('GET', '/transfers/stock', { who: 'CAJ' })).status,
    ).toBe(403);
  });

  it('sin stock suficiente bloquea el envío, informa lo disponible y no descuenta nada', async () => {
    const r = await enviar('ENC', envioBasico(11, 7));
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/Reduce la cantidad/);
    expect(r.body.faltantes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          idVariante: P1.idVariante,
          solicitado: 11,
          disponible: 10,
        }),
        expect.objectContaining({
          idVariante: P2.idVariante,
          solicitado: 7,
          disponible: 6,
        }),
      ]),
    );
    expect(await stock(P1.idVariante)).toMatchObject({
      [centro]: 10,
      [equipetrol]: 2,
    });
  });

  it('rechaza datos inválidos: mismo origen y destino, sucursal o prenda de otra empresa, cantidad 0', async () => {
    const base = envioBasico();
    expect(
      (await enviar('B', { ...base, idSucursalDestino: centro })).status,
    ).toBe(400);
    expect(
      (await enviar('B', { ...base, idSucursalDestino: sucursalA })).status,
    ).toBe(404);
    expect(
      (
        await enviar('B', {
          ...base,
          detalles: [{ idVariante: P1.idVariante, cantidad: 0 }],
        })
      ).status,
    ).toBe(400);
    const varianteA = (await c.api('GET', '/transfers/stock', { who: 'A' }))
      .body.variantes[0].idVariante;
    expect(
      (
        await enviar('B', {
          ...base,
          detalles: [{ idVariante: varianteA, cantidad: 1 }],
        })
      ).status,
    ).toBe(404);
  });

  it('el encargado no envía desde una sucursal ajena y el cajero no gestiona traspasos', async () => {
    const r = await enviar('ENC', {
      ...envioBasico(),
      idSucursalOrigen: equipetrol,
      idSucursalDestino: centro,
    });
    expect(r.status).toBe(403);
    expect((await enviar('CAJ', envioBasico())).status).toBe(403);
  });

  it('envío → EN_TRANSITO: descuenta del origen, el destino aún no suma y queda como pendiente', async () => {
    const antes = (await c.api('GET', '/transfers/pendientes', { who: 'B' }))
      .body.porRecibir;
    const r = await enviar('ENC', envioBasico(3, 2));
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({
      estado: 'EN_TRANSITO',
      origen: { idSucursal: centro },
      destino: { idSucursal: equipetrol },
      unidades: 5,
      puedeCancelar: true,
      puedeRecibir: false, // el encargado de Centro no opera Equipetrol
    });
    expect(await stock(P1.idVariante)).toMatchObject({
      [centro]: 7,
      [equipetrol]: 2,
    });
    expect(await stock(P2.idVariante)).toMatchObject({
      [centro]: 4,
      [equipetrol]: 1,
    });
    expect(
      (await c.api('GET', '/transfers/pendientes', { who: 'B' })).body
        .porRecibir,
    ).toBe(antes + 1);
    // Para el encargado de Centro no es "por recibir" (va hacia Equipetrol).
    const enc = await c.api('GET', '/transfers?estado=EN_TRANSITO', {
      who: 'ENC',
    });
    expect(
      enc.body.find((t: any) => t.idTraspaso === r.body.idTraspaso),
    ).toBeTruthy();
  });

  it('recepción parcial: exige motivo, suma lo recibido al destino y registra la merma', async () => {
    const t = (await enviar('B', envioBasico(2, 2))).body; // Centro: P1 7→5, P2 4→2
    // El encargado de Centro no puede recibir en Equipetrol.
    expect(
      (await recibir('ENC', t.idTraspaso, { detalles: lineas(t) })).status,
    ).toBe(403);
    // Más de lo enviado o líneas incompletas.
    expect(
      (await recibir('B', t.idTraspaso, { detalles: lineas(t, [3, 2]) }))
        .status,
    ).toBe(400);
    expect(
      (await recibir('B', t.idTraspaso, { detalles: lineas(t).slice(0, 1) }))
        .status,
    ).toBe(400);
    // Llegó menos sin motivo.
    expect(
      (await recibir('B', t.idTraspaso, { detalles: lineas(t, [1, 2]) }))
        .status,
    ).toBe(400);

    const r = await recibir('B', t.idTraspaso, {
      detalles: lineas(t, [1, 2]),
      observacion: 'Una prenda llegó con una mancha',
    });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({
      estado: 'RECIBIDO_PARCIAL',
      merma: 1,
      observacionCierre: 'Una prenda llegó con una mancha',
      puedeRecibir: false,
      puedeCancelar: false,
    });
    expect(r.body.detalles[0]).toMatchObject({
      cantidadEnviada: 2,
      cantidadRecibida: 1,
      merma: 1,
    });
    expect(await stock(P1.idVariante)).toMatchObject({
      [centro]: 5,
      [equipetrol]: 3,
    });
    expect(await stock(P2.idVariante)).toMatchObject({
      [centro]: 2,
      [equipetrol]: 3,
    });

    // Ya cerrado: ni otra recepción ni cancelación.
    expect(
      (await recibir('B', t.idTraspaso, { detalles: lineas(t) })).status,
    ).toBe(409);
    expect(
      (
        await c.api('POST', `/transfers/${t.idTraspaso}/cancelar`, {
          who: 'B',
          body: {},
        })
      ).status,
    ).toBe(409);
  });

  it('recepción completa → RECIBIDO; rechazo total → RECHAZADO sin sumar al destino', async () => {
    const t1 = (await enviar('B', envioBasico(1, 1))).body; // Centro: P1 5→4, P2 2→1
    const ok = await recibir('B', t1.idTraspaso, { detalles: lineas(t1) });
    expect(ok.body).toMatchObject({ estado: 'RECIBIDO', merma: 0 });
    expect(await stock(P1.idVariante)).toMatchObject({
      [centro]: 4,
      [equipetrol]: 4,
    });

    const t2 = (await enviar('B', envioBasico(1, 1))).body; // Centro: P1 4→3, P2 1→0
    const no = await recibir('B', t2.idTraspaso, {
      detalles: lineas(t2, [0, 0]),
      observacion: 'Caja mojada, todo dañado',
    });
    expect(no.body).toMatchObject({ estado: 'RECHAZADO', merma: 2 });
    expect(await stock(P1.idVariante)).toMatchObject({
      [centro]: 3,
      [equipetrol]: 4,
    });
    expect(await stock(P2.idVariante)).toMatchObject({
      [centro]: 0,
      [equipetrol]: 4,
    });
  });

  it('cancelar en tránsito devuelve el stock al origen; luego no se puede recibir', async () => {
    const t = (
      await enviar('ENC', {
        ...envioBasico(),
        detalles: [{ idVariante: P1.idVariante, cantidad: 2 }],
      })
    ).body;
    expect(await stock(P1.idVariante)).toMatchObject({ [centro]: 1 });
    const r = await c.api('POST', `/transfers/${t.idTraspaso}/cancelar`, {
      who: 'ENC',
      body: { motivo: 'Me equivoqué de talla' },
    });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({
      estado: 'CANCELADO',
      merma: 0,
      observacionCierre: 'Me equivoqué de talla',
    });
    expect(await stock(P1.idVariante)).toMatchObject({
      [centro]: 3,
      [equipetrol]: 4,
    });
    expect(
      (await recibir('B', t.idTraspaso, { detalles: lineas(t) })).status,
    ).toBe(409);
  });

  it('dos recepciones a la vez: solo una se aplica y el stock suma una sola vez', async () => {
    const t = (
      await enviar('B', {
        ...envioBasico(),
        detalles: [{ idVariante: P1.idVariante, cantidad: 2 }],
      })
    ).body;
    const [r1, r2] = await Promise.all([
      recibir('B', t.idTraspaso, { detalles: lineas(t) }),
      recibir('B', t.idTraspaso, { detalles: lineas(t) }),
    ]);
    expect([r1.status, r2.status].sort()).toEqual([201, 409]);
    expect(await stock(P1.idVariante)).toMatchObject({
      [centro]: 1,
      [equipetrol]: 6,
    });
  });

  it('cada paso deja su movimiento de inventario con la referencia del traspaso', async () => {
    const t = (
      await enviar('B', {
        ...envioBasico(),
        idSucursalOrigen: equipetrol,
        idSucursalDestino: centro,
        detalles: [{ idVariante: P1.idVariante, cantidad: 1 }],
      })
    ).body;
    await recibir('B', t.idTraspaso, { detalles: lineas(t) });
    const movs = (
      await c.api('GET', '/inventory/movimientos', { who: 'B' })
    ).body.filter((m: any) =>
      String(m.referencia).startsWith(`Traspaso #${t.idTraspaso} `),
    );
    expect(movs.map((m: any) => m.tipo).sort()).toEqual([
      'TRASPASO_ENTRADA',
      'TRASPASO_SALIDA',
    ]);
  });

  it('otra empresa no ve ni opera los traspasos de Urban Step', async () => {
    const t = (
      await enviar('B', {
        ...envioBasico(),
        idSucursalOrigen: equipetrol,
        idSucursalDestino: centro,
        detalles: [{ idVariante: P1.idVariante, cantidad: 1 }],
      })
    ).body;
    expect(
      (await c.api('GET', `/transfers/${t.idTraspaso}`, { who: 'A' })).status,
    ).toBe(404);
    expect(
      (await recibir('A', t.idTraspaso, { detalles: lineas(t) })).status,
    ).toBe(404);
    expect(
      (
        await c.api('POST', `/transfers/${t.idTraspaso}/cancelar`, {
          who: 'A',
          body: {},
        })
      ).status,
    ).toBe(404);
    const listaA = (await c.api('GET', '/transfers', { who: 'A' })).body;
    expect(listaA.some((x: any) => x.idTraspaso === t.idTraspaso)).toBe(false);
    // Se cancela para dejar todo como estaba.
    await c.api('POST', `/transfers/${t.idTraspaso}/cancelar`, {
      who: 'B',
      body: {},
    });
  });
});
