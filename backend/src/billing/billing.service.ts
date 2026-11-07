import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import Stripe from 'stripe';
import { DataSource } from 'typeorm';
import { Empresa } from '../tenancy/entities/empresa.entity';
import { Plan } from '../tenancy/entities/plan.entity';
import { SubscriptionsService } from '../tenancy/subscriptions.service';
import { TenantContext } from '../tenancy/tenant-context';
import { PagoSuscripcion } from './entities/pago-suscripcion.entity';
import {
  APP_METADATA,
  Checkout,
  Pasarela,
  SimuladaPasarela,
  StripePasarela,
} from './pasarela';

interface Actor {
  idUsuario: number;
  idEmpresa: number | null;
  email?: string;
}

/**
 * Cobro de la suscripción de las tiendas (planes en USD) con Stripe Checkout.
 *
 * 1. `iniciarCheckout`: registra el pago PENDIENTE y crea la sesión de pago en la pasarela.
 * 2. La persona paga en la página de Stripe y vuelve a /pago/exito (eso NO activa nada).
 * 3. Stripe avisa por webhook (`procesarWebhook`, con firma verificada) → `completarPago`
 *    activa el plan una sola vez aunque el aviso llegue repetido (idempotencia).
 * Con la pasarela simulada, el paso 3 lo dispara `pagarSimulado` desde la pantalla de prueba.
 */
@Injectable()
export class BillingService {
  private readonly log = new Logger(BillingService.name);
  private readonly pasarela: Pasarela;
  /** Cliente de Stripe solo para verificar firmas de webhooks (no hace llamadas de red). */
  private readonly verificador: Stripe;
  private readonly webhookSecret: string | undefined;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly subscriptions: SubscriptionsService,
    config: ConfigService,
  ) {
    const clave = config.get<string>('STRIPE_SECRET_KEY')?.trim();
    const appUrl = (
      config.get<string>('APP_URL') ??
      config.get<string>('CORS_ORIGINS')?.split(',')[0] ??
      'http://localhost:5173'
    )
      .trim()
      .replace(/\/$/, '');
    const forzarSimulado =
      config.get<string>('BILLING_PROVIDER') === 'simulado';
    this.pasarela =
      clave && !forzarSimulado
        ? new StripePasarela(new Stripe(clave), appUrl)
        : new SimuladaPasarela(appUrl);
    this.verificador = new Stripe(
      clave || 'sk_test_solo_para_verificar_firmas',
    );
    this.webhookSecret =
      config.get<string>('STRIPE_WEBHOOK_SECRET')?.trim() || undefined;
    this.log.log(`Cobro de suscripciones con pasarela ${this.pasarela.nombre}`);
  }

  get proveedor() {
    return this.pasarela.nombre;
  }

  // ------------------------------------------------------------ iniciar

  /** El administrador elige plan y meses → URL de la página de pago. */
  async iniciarCheckout(actor: Actor, codigoPlan: string, meses = 1) {
    const idEmpresa = this.empresaDe(actor);
    return this.crearCheckout(idEmpresa, codigoPlan, meses, actor);
  }

  /** También lo usa el registro público (empresa recién creada, en modo plataforma). */
  async crearCheckout(
    idEmpresa: number,
    codigoPlan: string,
    meses: number,
    actor?: Actor,
  ): Promise<Checkout & { proveedor: string; activadoSinPago?: boolean }> {
    const repo = this.dataSource.getRepository(PagoSuscripcion);
    const plan = await this.dataSource
      .getRepository(Plan)
      .findOne({
        where: { codigo: codigoPlan as Plan['codigo'], activo: true },
      });
    if (!plan) throw new NotFoundException(`Plan ${codigoPlan} no disponible`);
    const empresa = await this.dataSource
      .getRepository(Empresa)
      .findOne({ where: { idEmpresa } });
    if (!empresa) throw new NotFoundException('Empresa no encontrada');

    const montoCentavos =
      Math.round(Number(plan.precioReferencia) * 100) * meses;
    const pago = await repo.save(
      repo.create({
        idEmpresa,
        referencia: `pendiente-${idEmpresa}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        proveedor: this.pasarela.nombre,
        codigoPlan,
        meses,
        monto: (montoCentavos / 100).toFixed(2),
        moneda: 'USD',
        estado: 'PENDIENTE',
        idUsuario: actor?.idUsuario ?? null,
      }),
    );

    // Plan gratuito: no hay nada que cobrar.
    if (montoCentavos === 0) {
      await this.completarPago(pago.referencia, null);
      return {
        referencia: pago.referencia,
        url: '',
        proveedor: pago.proveedor,
        activadoSinPago: true,
      };
    }

    let checkout: Checkout;
    try {
      checkout = await this.pasarela.crearCheckout({
        idPago: pago.idPagoSuscripcion,
        idEmpresa,
        empresa: empresa.nombre,
        codigoPlan,
        nombrePlan: plan.nombre,
        meses,
        montoCentavos,
        email: actor?.email,
      });
    } catch (e) {
      await repo.update(
        { idPagoSuscripcion: pago.idPagoSuscripcion },
        { estado: 'CANCELADO' },
      );
      this.log.error(`No se pudo crear el checkout: ${(e as Error).message}`);
      throw new ServiceUnavailableException(
        'La pasarela de pago no está disponible. Intenta de nuevo en unos minutos.',
      );
    }
    await repo.update(
      { idPagoSuscripcion: pago.idPagoSuscripcion },
      { referencia: checkout.referencia },
    );
    return { ...checkout, proveedor: pago.proveedor };
  }

  // ------------------------------------------------------------ consultar / cancelar

  async consultar(actor: Actor, referencia: string) {
    const pago = await this.dataSource
      .getRepository(PagoSuscripcion)
      .findOne({ where: { referencia, idEmpresa: this.empresaDe(actor) } });
    if (!pago) throw new NotFoundException('Pago no encontrado');
    return this.vista(pago);
  }

  async historial(actor: Actor) {
    const pagos = await this.dataSource.getRepository(PagoSuscripcion).find({
      where: { idEmpresa: this.empresaDe(actor) },
      order: { idPagoSuscripcion: 'DESC' },
      take: 50,
    });
    return Promise.all(pagos.map((p) => this.vista(p)));
  }

  /** El usuario volvió con "Cancelar": el pago pendiente queda CANCELADO (si ya se pagó, no se toca). */
  async cancelar(actor: Actor, referencia: string) {
    const repo = this.dataSource.getRepository(PagoSuscripcion);
    const pago = await repo.findOne({
      where: { referencia, idEmpresa: this.empresaDe(actor) },
    });
    if (!pago) throw new NotFoundException('Pago no encontrado');
    if (pago.estado === 'PENDIENTE') {
      await repo.update(
        { idPagoSuscripcion: pago.idPagoSuscripcion, estado: 'PENDIENTE' },
        { estado: 'CANCELADO' },
      );
      if (pago.proveedor === this.pasarela.nombre)
        await this.pasarela.expirar(referencia);
    }
    return this.consultar(actor, referencia);
  }

  // ------------------------------------------------------------ confirmar

  /** Pantalla de pago simulado (solo con la pasarela SIMULADO). */
  async pagarSimulado(actor: Actor, referencia: string) {
    if (this.pasarela.nombre !== 'SIMULADO')
      throw new BadRequestException(
        'El pago simulado está desactivado: se cobra con Stripe.',
      );
    const pago = await this.dataSource
      .getRepository(PagoSuscripcion)
      .findOne({ where: { referencia, idEmpresa: this.empresaDe(actor) } });
    if (!pago || pago.proveedor !== 'SIMULADO')
      throw new NotFoundException('Pago no encontrado');
    if (pago.estado === 'CANCELADO' || pago.estado === 'EXPIRADO')
      throw new BadRequestException(
        'Este pago fue cancelado. Inicia uno nuevo desde Mi plan.',
      );
    await this.completarPago(referencia, `sim_cobro_${pago.idPagoSuscripcion}`);
    return this.consultar(actor, referencia);
  }

  /**
   * Webhook de Stripe. Verifica la firma (con STRIPE_WEBHOOK_SECRET) y procesa solo los
   * eventos de ESTA aplicación (`metadata.app = fashionstore`): la cuenta de prueba puede
   * tener otros proyectos. Devuelve qué hizo, para el registro y las pruebas.
   */
  async procesarWebhook(cuerpo: Buffer | undefined, firma: string | undefined) {
    if (!this.webhookSecret)
      throw new ServiceUnavailableException(
        'Webhook de Stripe no configurado (falta STRIPE_WEBHOOK_SECRET)',
      );
    if (!cuerpo || !firma)
      throw new BadRequestException('Falta el cuerpo o la firma del webhook');
    let evento: Stripe.Event;
    try {
      evento = this.verificador.webhooks.constructEvent(
        cuerpo,
        firma,
        this.webhookSecret,
      );
    } catch {
      throw new BadRequestException('Firma del webhook inválida');
    }

    const sesion = evento.data.object as Stripe.Checkout.Session;
    if (
      !evento.type.startsWith('checkout.session.') ||
      sesion?.metadata?.app !== APP_METADATA
    )
      return { recibido: true, accion: 'ignorado' as const };

    return TenantContext.runAsPlatform(async () => {
      switch (evento.type) {
        case 'checkout.session.completed':
        case 'checkout.session.async_payment_succeeded': {
          if (sesion.payment_status !== 'paid')
            return { recibido: true, accion: 'esperando_pago' as const };
          const r = await this.completarPago(
            sesion.id,
            typeof sesion.payment_intent === 'string'
              ? sesion.payment_intent
              : (sesion.payment_intent?.id ?? null),
            sesion.amount_total,
          );
          return { recibido: true, accion: r };
        }
        case 'checkout.session.expired':
        case 'checkout.session.async_payment_failed':
          await this.dataSource
            .getRepository(PagoSuscripcion)
            .update(
              { referencia: sesion.id, estado: 'PENDIENTE' },
              { estado: 'EXPIRADO' },
            );
          return { recibido: true, accion: 'expirado' as const };
        default:
          return { recibido: true, accion: 'ignorado' as const };
      }
    });
  }

  /**
   * Marca el pago como PAGADO y activa el plan, todo en una transacción con la fila del
   * pago bloqueada: si el aviso llega dos veces (Stripe reintenta), la segunda no hace nada.
   * Si la persona canceló pero igual pagó en otra pestaña, se activa (el dinero ya entró).
   */
  async completarPago(
    referencia: string,
    idCobro: string | null,
    montoCentavos?: number | null,
  ) {
    return this.dataSource.transaction(async (m) => {
      const pago = await m
        .createQueryBuilder(PagoSuscripcion, 'p')
        .setLock('pessimistic_write')
        .where('p.referencia = :referencia', { referencia })
        .getOne();
      if (!pago) {
        this.log.warn(`Pago con referencia ${referencia} no encontrado`);
        return 'desconocido' as const;
      }
      if (pago.estado === 'PAGADO') return 'ya_procesado' as const;
      const esperado = Math.round(Number(pago.monto) * 100);
      if (montoCentavos != null && montoCentavos !== esperado) {
        this.log.error(
          `Monto distinto en el pago ${referencia}: ${montoCentavos} ≠ ${esperado}`,
        );
        return 'monto_distinto' as const;
      }
      const suscripcion = await this.subscriptions.activarPlanEn(
        m,
        pago.idEmpresa,
        pago.codigoPlan,
        pago.meses,
      );
      await m.update(
        PagoSuscripcion,
        { idPagoSuscripcion: pago.idPagoSuscripcion },
        {
          estado: 'PAGADO',
          pagadoEn: new Date(),
          idCobroPasarela: idCobro,
          idSuscripcion: suscripcion.idSuscripcion,
        },
      );
      this.log.log(
        `Pago ${referencia} confirmado: empresa ${pago.idEmpresa} → plan ${pago.codigoPlan} (${pago.meses} meses)`,
      );
      return 'activado' as const;
    });
  }

  // ------------------------------------------------------------ ayudas

  private empresaDe(actor: Actor) {
    if (actor.idEmpresa == null)
      throw new ForbiddenException(
        'El pago de la suscripción lo hace el administrador de una empresa',
      );
    return actor.idEmpresa;
  }

  private async vista(p: PagoSuscripcion) {
    const plan = await this.dataSource
      .getRepository(Plan)
      .findOne({ where: { codigo: p.codigoPlan as Plan['codigo'] } });
    return {
      referencia: p.referencia,
      estado: p.estado,
      proveedor: p.proveedor,
      codigoPlan: p.codigoPlan,
      nombrePlan: plan?.nombre ?? p.codigoPlan,
      meses: p.meses,
      monto: Number(p.monto),
      moneda: p.moneda,
      creadoEn: p.creadoEn,
      pagadoEn: p.pagadoEn,
    };
  }
}
