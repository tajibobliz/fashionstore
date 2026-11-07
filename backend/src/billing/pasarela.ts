import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import type { ProveedorPago } from './entities/pago-suscripcion.entity';

/** Marca de esta aplicación en los metadatos de Stripe (la cuenta de prueba puede tener otros proyectos). */
export const APP_METADATA = 'fashionstore';

export interface DatosCheckout {
  idPago: number;
  idEmpresa: number;
  empresa: string;
  codigoPlan: string;
  nombrePlan: string;
  meses: number;
  /** En centavos de USD. */
  montoCentavos: number;
  email?: string;
}

export interface Checkout {
  referencia: string;
  url: string;
}

/**
 * Pasarela con la que se cobra la suscripción.
 *  - STRIPE: Stripe Checkout (página de pago alojada por Stripe). Se usa si hay STRIPE_SECRET_KEY.
 *  - SIMULADO: sin claves (o BILLING_PROVIDER=simulado, como en las pruebas): una pantalla
 *    propia imita el pago. Sirve para pruebas automáticas y para demostrar sin internet.
 */
export interface Pasarela {
  readonly nombre: ProveedorPago;
  crearCheckout(d: DatosCheckout): Promise<Checkout>;
  /** Cierra la sesión de pago si el usuario canceló (no falla si ya no se puede). */
  expirar(referencia: string): Promise<void>;
}

export function urlsRetorno(appUrl: string) {
  return {
    exito: `${appUrl}/pago/exito`,
    cancelado: `${appUrl}/pago/cancelado`,
  };
}

export class StripePasarela implements Pasarela {
  readonly nombre = 'STRIPE' as const;
  constructor(
    private readonly stripe: Stripe,
    private readonly appUrl: string,
  ) {}

  async crearCheckout(d: DatosCheckout): Promise<Checkout> {
    const { exito, cancelado } = urlsRetorno(this.appUrl);
    const metadata = {
      app: APP_METADATA,
      idPago: String(d.idPago),
      idEmpresa: String(d.idEmpresa),
      codigoPlan: d.codigoPlan,
      meses: String(d.meses),
    };
    const s = await this.stripe.checkout.sessions.create(
      {
        mode: 'payment',
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: d.montoCentavos,
              product_data: {
                name: `FashionStore SaaS · Plan ${d.nombrePlan}`,
                description: `${d.empresa} · ${d.meses} ${d.meses === 1 ? 'mes' : 'meses'}`,
              },
            },
          },
        ],
        // {CHECKOUT_SESSION_ID} lo reemplaza Stripe: la página de éxito consulta ese pago.
        success_url: `${exito}?ref={CHECKOUT_SESSION_ID}`,
        cancel_url: `${cancelado}?ref={CHECKOUT_SESSION_ID}`,
        client_reference_id: String(d.idEmpresa),
        customer_email: d.email,
        metadata,
        payment_intent_data: {
          description: `FashionStore SaaS · Plan ${d.nombrePlan} · ${d.empresa}`,
          metadata,
        },
      },
      // Si el backend reintenta la misma creación, Stripe devuelve la misma sesión.
      { idempotencyKey: `fashionstore-pago-${d.idPago}` },
    );
    if (!s.url) throw new Error('Stripe no devolvió la URL de pago');
    return { referencia: s.id, url: s.url };
  }

  async expirar(referencia: string) {
    try {
      await this.stripe.checkout.sessions.expire(referencia);
    } catch {
      // Ya pagada, ya expirada o inexistente: no hay nada que cerrar.
    }
  }
}

export class SimuladaPasarela implements Pasarela {
  readonly nombre = 'SIMULADO' as const;
  constructor(private readonly appUrl: string) {}

  crearCheckout(): Promise<Checkout> {
    const referencia = `sim_${randomUUID()}`;
    return Promise.resolve({
      referencia,
      url: `${this.appUrl}/pago/simulado?ref=${referencia}`,
    });
  }

  expirar() {
    return Promise.resolve();
  }
}
