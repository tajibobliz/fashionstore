import { jest } from '@jest/globals';
import type Stripe from 'stripe';
import { APP_METADATA, SimuladaPasarela, StripePasarela } from './pasarela';

const datos = {
  idPago: 41,
  idEmpresa: 7,
  empresa: 'Tienda Demo',
  codigoPlan: 'PROFESIONAL',
  nombrePlan: 'Profesional',
  meses: 3,
  montoCentavos: 14700,
  email: 'admin@tienda.demo',
};

describe('StripePasarela', () => {
  it('crea la sesión de Checkout en USD con el monto, la marca de la app y las URLs de retorno', async () => {
    const create = jest
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockResolvedValue({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/c/pay/cs_test_123',
      });
    const stripe = {
      checkout: { sessions: { create, expire: jest.fn() } },
    } as unknown as Stripe;
    const r = await new StripePasarela(
      stripe,
      'http://localhost:5173',
    ).crearCheckout(datos);

    expect(r).toEqual({
      referencia: 'cs_test_123',
      url: 'https://checkout.stripe.com/c/pay/cs_test_123',
    });
    const [params, opciones] = create.mock.calls[0] as [any, unknown];
    expect(params).toMatchObject({
      mode: 'payment',
      success_url: 'http://localhost:5173/pago/exito?ref={CHECKOUT_SESSION_ID}',
      cancel_url:
        'http://localhost:5173/pago/cancelado?ref={CHECKOUT_SESSION_ID}',
      customer_email: 'admin@tienda.demo',
      client_reference_id: '7',
      metadata: {
        app: APP_METADATA,
        idPago: '41',
        idEmpresa: '7',
        codigoPlan: 'PROFESIONAL',
        meses: '3',
      },
    });
    expect(params.line_items[0]).toMatchObject({
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: 14700,
        product_data: { name: 'FashionCloud · Plan Profesional' },
      },
    });
    // El cobro también lleva la marca (el panel de Stripe muestra de qué app es).
    expect(params.payment_intent_data.metadata.app).toBe(APP_METADATA);
    expect(opciones).toEqual({ idempotencyKey: 'fashionstore-pago-41' });
  });

  it('expirar no falla si la sesión ya no se puede cerrar', async () => {
    const expire = jest
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockRejectedValue(new Error('ya pagada'));
    const stripe = {
      checkout: { sessions: { create: jest.fn(), expire } },
    } as unknown as Stripe;
    await expect(
      new StripePasarela(stripe, 'http://x').expirar('cs_test_1'),
    ).resolves.toBeUndefined();
  });
});

describe('SimuladaPasarela', () => {
  it('devuelve una referencia sim_ y la URL de la pantalla de pago simulado', async () => {
    const r = await new SimuladaPasarela(
      'http://localhost:5173',
    ).crearCheckout();
    expect(r.referencia).toMatch(/^sim_[0-9a-f-]{36}$/);
    expect(r.url).toBe(
      `http://localhost:5173/pago/simulado?ref=${r.referencia}`,
    );
  });
});
