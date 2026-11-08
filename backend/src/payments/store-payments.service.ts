import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Role } from '../auth/enums/role.enum';
import { BillingService } from '../billing/billing.service';
import { montoMinimo } from '../billing/pasarela';
import { formatearMonto } from '../common/monedas';
import { Venta } from '../sales/entities/venta.entity';
import { Empresa } from '../tenancy/entities/empresa.entity';
import { BranchAccessService } from '../users/branch-access.service';
import { MIME_COMPROBANTE, MIME_IMAGEN, decodificarArchivo } from './archivos';
import {
  ActualizarConfigPagoDto,
  SubirComprobanteDto,
  SubirQrDto,
} from './dto/store-payments.dto';
import { ComprobantePago } from './entities/comprobante-pago.entity';
import { ConfigPagoTienda } from './entities/config-pago-tienda.entity';
import { MetodoPago, Pago } from './entities/pago.entity';
import { PaymentsService } from './payments.service';

const MAX_QR = 600 * 1024;
const MAX_COMPROBANTE = 3 * 1024 * 1024;
const PERSONAL = [
  Role.ADMIN,
  Role.ENCARGADO,
  Role.ENCARGADO_SUCURSAL,
  Role.CAJERO,
];

/** Qué opción de la configuración habilita cada método de pago (en la tienda online). */
const OPCION: Record<
  MetodoPago,
  keyof Pick<
    ConfigPagoTienda,
    'tarjeta' | 'qr' | 'transferencia' | 'efectivoRetiro' | 'contraentrega'
  >
> = {
  TARJETA: 'tarjeta',
  QR: 'qr',
  TRANSFERENCIA: 'transferencia',
  EFECTIVO: 'efectivoRetiro',
  CONTRAPAGO: 'contraentrega',
};

/**
 * Medios de pago de la tienda online (todos los planes):
 *  - tarjeta con Stripe Checkout en la moneda de la tienda (confirmación por webhook),
 *  - QR y transferencia con comprobante que el personal verifica,
 *  - efectivo al retirar en sucursal y contra entrega (se aprueban al cobrar).
 * Aprobar un pago confirma la venta y descuenta el stock (PaymentsService.updateEstado).
 */
@Injectable()
export class StorePaymentsService implements OnModuleInit {
  private readonly log = new Logger(StorePaymentsService.name);

  constructor(
    @InjectRepository(ConfigPagoTienda)
    private readonly configs: Repository<ConfigPagoTienda>,
    @InjectRepository(ComprobantePago)
    private readonly comprobantes: Repository<ComprobantePago>,
    @InjectRepository(Pago) private readonly pagos: Repository<Pago>,
    @InjectRepository(Venta) private readonly ventas: Repository<Venta>,
    private readonly payments: PaymentsService,
    private readonly billing: BillingService,
    private readonly access: BranchAccessService,
    private readonly dataSource: DataSource,
  ) {}

  /** El webhook de Stripe (BillingService) nos entrega los cobros de ventas confirmados. */
  onModuleInit() {
    this.billing.registrarManejadorVenta((idPago, idCobro, monto) =>
      this.aprobarPorPasarela(idPago, idCobro, monto),
    );
  }

  // ------------------------------------------------------------ configuración (ADMIN)

  async config(actor: AuthenticatedUser) {
    const c = await this.configDe(this.empresa(actor));
    return this.vistaConfig(c);
  }

  async actualizarConfig(
    actor: AuthenticatedUser,
    dto: ActualizarConfigPagoDto,
  ) {
    const idEmpresa = this.empresa(actor);
    const c = await this.configDe(idEmpresa);
    const texto = (v: string | undefined, actual: string | null) =>
      v === undefined ? actual : v.trim() || null;
    Object.assign(c, {
      tarjeta: dto.tarjeta ?? c.tarjeta,
      qr: dto.qr ?? c.qr,
      transferencia: dto.transferencia ?? c.transferencia,
      efectivoRetiro: dto.efectivoRetiro ?? c.efectivoRetiro,
      contraentrega: dto.contraentrega ?? c.contraentrega,
      banco: texto(dto.banco, c.banco),
      titular: texto(dto.titular, c.titular),
      numeroCuenta: texto(dto.numeroCuenta, c.numeroCuenta),
      tipoCuenta: texto(dto.tipoCuenta, c.tipoCuenta),
      documentoTitular: texto(dto.documentoTitular, c.documentoTitular),
      instrucciones: texto(dto.instrucciones, c.instrucciones),
    });
    if (
      ![
        c.tarjeta,
        c.qr,
        c.transferencia,
        c.efectivoRetiro,
        c.contraentrega,
      ].some(Boolean)
    )
      throw new BadRequestException(
        'Deja al menos un medio de pago activo para que tus clientas puedan comprar',
      );
    if (c.qr && !c.qrMime)
      throw new BadRequestException(
        'Para activar el pago por QR, primero sube la imagen de tu QR',
      );
    if (c.transferencia && (!c.banco || !c.titular || !c.numeroCuenta))
      throw new BadRequestException(
        'Para activar la transferencia completa banco, titular y número de cuenta',
      );
    return this.vistaConfig(await this.configs.save(c));
  }

  async subirQr(actor: AuthenticatedUser, dto: SubirQrDto) {
    const c = await this.configDe(this.empresa(actor));
    c.qrImagen = decodificarArchivo(
      dto.archivoBase64,
      dto.mime,
      MAX_QR,
      MIME_IMAGEN,
    );
    c.qrMime = dto.mime;
    return this.vistaConfig(await this.configs.save(c));
  }

  /** Quita el QR de la tienda; el pago por QR se desactiva porque ya no hay nada que escanear. */
  async quitarQr(actor: AuthenticatedUser) {
    const c = await this.configDe(this.empresa(actor));
    c.qrImagen = null;
    c.qrMime = null;
    c.qr = false;
    if (
      ![c.tarjeta, c.transferencia, c.efectivoRetiro, c.contraentrega].some(
        Boolean,
      )
    )
      throw new BadRequestException(
        'El QR es tu único medio activo: activa otro antes de quitarlo',
      );
    return this.vistaConfig(await this.configs.save(c));
  }

  async imagenQr(actor: AuthenticatedUser) {
    const fila = await this.configs
      .createQueryBuilder('c')
      .addSelect('c.qrImagen')
      .where('c.id_empresa = :e', { e: this.empresa(actor) })
      .getOne();
    if (!fila?.qrImagen || !fila.qrMime)
      throw new NotFoundException('La tienda no tiene un QR configurado');
    return { datos: fila.qrImagen, mime: fila.qrMime };
  }

  /** Lo que ve la clienta al pagar: medios activos y, si aplica, los datos de la cuenta. */
  async metodos(actor: AuthenticatedUser) {
    const idEmpresa = this.empresa(actor);
    const c = await this.configDe(idEmpresa);
    const empresa = await this.dataSource
      .getRepository(Empresa)
      .findOne({ where: { idEmpresa } });
    return {
      moneda: empresa?.moneda ?? 'BOB',
      proveedorTarjeta: this.billing.proveedor,
      tarjeta: c.tarjeta,
      qr: c.qr && !!c.qrMime,
      transferencia: c.transferencia,
      efectivoRetiro: c.efectivoRetiro,
      contraentrega: c.contraentrega,
      cuenta: c.transferencia
        ? {
            banco: c.banco,
            titular: c.titular,
            numeroCuenta: c.numeroCuenta,
            tipoCuenta: c.tipoCuenta,
            documentoTitular: c.documentoTitular,
          }
        : null,
      instrucciones: c.instrucciones,
    };
  }

  /** Antes de que una clienta registre un pago: el medio debe estar activo en su tienda. */
  async validarPagoCliente(
    actor: AuthenticatedUser,
    idVenta: number,
    metodo: MetodoPago,
  ) {
    if (metodo === 'TARJETA')
      throw new BadRequestException(
        'Para pagar con tarjeta usa "Pagar con tarjeta" (página segura de pago).',
      );
    const c = await this.configDe(this.empresa(actor));
    const activo = metodo === 'QR' ? c.qr && !!c.qrMime : c[OPCION[metodo]];
    if (!activo)
      throw new BadRequestException('Esta tienda no acepta ese medio de pago');
    // Si cambió de método, el intento anterior pendiente deja de valer.
    await this.anularPendientes(idVenta, metodo);
  }

  // ------------------------------------------------------------ comprobantes (QR / transferencia)

  async subirComprobante(
    actor: AuthenticatedUser,
    idPago: number,
    dto: SubirComprobanteDto,
  ) {
    const pago = await this.pagoAutorizado(actor, idPago);
    if (pago.metodo !== 'QR' && pago.metodo !== 'TRANSFERENCIA')
      throw new BadRequestException(
        'Solo los pagos por QR o transferencia llevan comprobante',
      );
    if (pago.estado !== 'PENDIENTE')
      throw new BadRequestException(
        `El pago ya está ${pago.estado.toLowerCase()}`,
      );
    const datos = decodificarArchivo(
      dto.archivoBase64,
      dto.mime,
      MAX_COMPROBANTE,
      MIME_COMPROBANTE,
    );
    const existente = await this.comprobantes.findOne({
      where: { pago: { idPago } },
    });
    await this.comprobantes.save(
      this.comprobantes.create({
        ...(existente ? { idComprobante: existente.idComprobante } : {}),
        idEmpresa: pago.idEmpresa,
        pago: { idPago } as Pago,
        mime: dto.mime,
        nombre: dto.nombre?.trim() || null,
        bytes: datos.length,
        datos,
      }),
    );
    return {
      idPago,
      comprobante: {
        mime: dto.mime,
        bytes: datos.length,
        nombre: dto.nombre ?? null,
      },
    };
  }

  async comprobante(actor: AuthenticatedUser, idPago: number) {
    await this.pagoAutorizado(actor, idPago);
    const c = await this.comprobantes
      .createQueryBuilder('c')
      .addSelect('c.datos')
      .where('c.id_pago = :idPago', { idPago })
      .getOne();
    if (!c) throw new NotFoundException('Este pago no tiene comprobante');
    return { datos: c.datos, mime: c.mime, nombre: c.nombre };
  }

  // ------------------------------------------------------------ verificación (personal)

  /** Pagos de la tienda online esperando que alguien los verifique o cobre. */
  async porVerificar(actor: AuthenticatedUser) {
    if (!PERSONAL.includes(actor.rol))
      throw new ForbiddenException('Solo el personal verifica pagos');
    const qb = this.pagos
      .createQueryBuilder('p')
      .innerJoinAndSelect('p.venta', 'v')
      .leftJoinAndSelect('v.usuario', 'u')
      .leftJoinAndSelect('v.sucursal', 's')
      .leftJoin(ComprobantePago, 'c', 'c.id_pago = p.id_pago')
      .addSelect(['c.idComprobante', 'c.mime', 'c.bytes', 'c.subidoEn'])
      .where('p.id_empresa = :e AND p.estado = :pend AND v.tipo_venta = :dig', {
        e: this.empresa(actor),
        pend: 'PENDIENTE',
        dig: 'DIGITAL',
      })
      .andWhere('p.metodo <> :tarjeta', { tarjeta: 'TARJETA' })
      .orderBy('p.fecha', 'ASC');
    const ids = await this.access.accessibleBranchIds(actor);
    if (ids !== null) {
      if (!ids.length) return [];
      qb.andWhere('s.id_sucursal IN (:...ids)', { ids });
    }
    const { entities, raw } = await qb.getRawAndEntities();
    const empresa = await this.dataSource
      .getRepository(Empresa)
      .findOne({ where: { idEmpresa: this.empresa(actor) } });
    return entities.map((p, i) => {
      const fila = raw[i] as Record<string, unknown>;
      return {
        idPago: p.idPago,
        metodo: p.metodo,
        monto: Number(p.monto),
        montoTexto: formatearMonto(Number(p.monto), empresa?.moneda),
        fecha: p.fecha,
        venta: {
          idVenta: p.venta.idVenta,
          comprobante: p.venta.numeroComprobante,
          estado: p.venta.estado,
          sucursal: p.venta.sucursal?.nombre ?? null,
        },
        cliente: p.venta.usuario
          ? {
              nombre:
                `${p.venta.usuario.nombre} ${p.venta.usuario.apellido ?? ''}`.trim(),
              email: p.venta.usuario.email,
            }
          : null,
        comprobante: fila.c_id_comprobante
          ? {
              mime: String(fila.c_mime),
              bytes: Number(fila.c_bytes),
              subidoEn: fila.c_subido_en,
            }
          : null,
      };
    });
  }

  // ------------------------------------------------------------ tarjeta (Stripe)

  /** La clienta elige tarjeta: se crea el pago PENDIENTE y la sesión de Stripe en la moneda de la tienda. */
  async pagarConTarjeta(actor: AuthenticatedUser, idVenta: number) {
    const venta = await this.ventas.findOne({ where: { idVenta } });
    if (!venta) throw new NotFoundException(`Venta ${idVenta} no encontrada`);
    if (
      actor.rol !== Role.CLIENTE ||
      venta.usuario?.idUsuario !== actor.idUsuario
    )
      throw new ForbiddenException(
        'Solo la clienta que hizo la compra puede pagarla',
      );
    if (venta.tipoVenta !== 'DIGITAL' || venta.estado !== 'PENDIENTE')
      throw new BadRequestException(
        `Esta compra no se puede pagar (estado ${venta.estado})`,
      );
    const idEmpresa = this.empresa(actor);
    const c = await this.configDe(idEmpresa);
    if (!c.tarjeta)
      throw new BadRequestException('Esta tienda no acepta pagos con tarjeta');
    const empresa = await this.dataSource
      .getRepository(Empresa)
      .findOneOrFail({ where: { idEmpresa } });

    await this.anularPendientes(idVenta, 'TARJETA');
    let pago = await this.pagos.findOne({
      where: { venta: { idVenta }, metodo: 'TARJETA', estado: 'PENDIENTE' },
    });
    if (!pago)
      pago = await this.pagos.save(
        this.pagos.create({
          venta,
          metodo: 'TARJETA',
          monto: venta.total,
          estado: 'PENDIENTE',
        }),
      );

    const base = `${this.billing.appUrl}/t/${empresa.slug}/compra/${idVenta}`;
    try {
      const checkout = await this.billing.pasarelaActual.crearCheckoutVenta({
        idPago: pago.idPago,
        idVenta,
        idEmpresa,
        tienda: empresa.nombre,
        moneda: empresa.moneda,
        montoMinimo: montoMinimo(Number(venta.total), empresa.moneda),
        descripcion: `Compra ${venta.numeroComprobante ?? `#${idVenta}`}`,
        email: venta.usuario?.email,
        exito: `${base}?ref={CHECKOUT_SESSION_ID}`,
        cancelado: `${base}?cancelado=1`,
      });
      await this.pagos.update(
        { idPago: pago.idPago },
        { referenciaPasarela: checkout.referencia.slice(0, 150) },
      );
      return {
        idPago: pago.idPago,
        url: checkout.url,
        proveedor: this.billing.proveedor,
      };
    } catch (e) {
      this.log.error(
        `No se pudo crear el cobro con tarjeta: ${(e as Error).message}`,
      );
      throw new ServiceUnavailableException(
        'El pago con tarjeta no está disponible ahora. Prueba otro medio o intenta más tarde.',
      );
    }
  }

  /** Pantalla de tarjeta simulada (solo sin claves de Stripe o en pruebas). */
  async pagarTarjetaSimulada(actor: AuthenticatedUser, idPago: number) {
    if (this.billing.proveedor !== 'SIMULADO')
      throw new BadRequestException(
        'El pago simulado está desactivado: se cobra con Stripe.',
      );
    const pago = await this.pagoAutorizado(actor, idPago);
    if (pago.metodo !== 'TARJETA')
      throw new BadRequestException('No es un pago con tarjeta');
    const r = await this.aprobarPorPasarela(
      idPago,
      `SIM-${idPago}-${Date.now().toString(36).toUpperCase()}`,
      null,
    );
    return { idPago, resultado: r, pago: await this.payments.findOne(idPago) };
  }

  /**
   * Stripe confirmó el cobro de una venta: aprueba el pago y confirma la venta (descuenta stock).
   * Idempotente. Si mientras pagaba se agotó una prenda, el pago queda RECHAZADO y se reembolsa
   * el dinero automáticamente (CU16: "pago entró pero el stock ya no está").
   */
  async aprobarPorPasarela(
    idPago: number,
    idCobro: string | null,
    montoRecibido: number | null,
  ) {
    const pago = await this.pagos.findOne({ where: { idPago } });
    if (!pago) return 'desconocido';
    if (pago.estado === 'APROBADO') return 'ya_procesado';
    if (montoRecibido != null) {
      const empresa = await this.dataSource
        .getRepository(Empresa)
        .findOne({ where: { idEmpresa: pago.idEmpresa } });
      if (
        montoRecibido !==
        montoMinimo(Number(pago.monto), empresa?.moneda ?? 'BOB')
      ) {
        this.log.error(
          `Monto distinto en el pago de venta ${idPago}: ${montoRecibido}`,
        );
        return 'monto_distinto';
      }
    }
    try {
      await this.payments.updateEstado(idPago, {
        estado: 'APROBADO',
        referenciaPasarela: idCobro ?? undefined,
      });
      return 'aprobado';
    } catch (e) {
      if (!(e instanceof BadRequestException)) throw e;
      this.log.warn(
        `Pago ${idPago} cobrado pero la venta no se pudo confirmar (${e.message}): se reembolsa`,
      );
      await this.payments
        .updateEstado(idPago, {
          estado: 'RECHAZADO',
          referenciaPasarela: idCobro ?? undefined,
        })
        .catch(() => undefined);
      if (idCobro)
        await this.billing.pasarelaActual
          .reembolsar(idCobro)
          .catch((err) =>
            this.log.error(`Reembolso fallido: ${(err as Error).message}`),
          );
      return 'reembolsado';
    }
  }

  // ------------------------------------------------------------ ayudas

  private empresa(actor: AuthenticatedUser) {
    if (actor.idEmpresa == null)
      throw new ForbiddenException('Operación de una tienda');
    return actor.idEmpresa;
  }

  private async configDe(idEmpresa: number) {
    return (
      (await this.configs.findOne({ where: { idEmpresa } })) ??
      this.configs.create({
        idEmpresa,
        tarjeta: true,
        qr: false,
        transferencia: false,
        efectivoRetiro: true,
        contraentrega: false,
      })
    );
  }

  private vistaConfig(c: ConfigPagoTienda) {
    const { qrImagen: _q, idEmpresa: _e, empresa: _em, ...resto } = c;
    return {
      ...resto,
      qrSubido: !!c.qrMime,
      proveedorTarjeta: this.billing.proveedor,
    };
  }

  /** Dueña de la compra o personal con acceso a esa sucursal. */
  private async pagoAutorizado(actor: AuthenticatedUser, idPago: number) {
    const pago = await this.pagos.findOne({ where: { idPago } });
    if (!pago) throw new NotFoundException(`Pago ${idPago} no encontrado`);
    await this.payments.assertCanAccessSale(
      pago.venta,
      actor,
      'usar el pago de',
    );
    return pago;
  }

  private async anularPendientes(idVenta: number, salvoMetodo: MetodoPago) {
    const otros = await this.pagos.find({
      where: { venta: { idVenta }, estado: 'PENDIENTE' },
    });
    const ids = otros
      .filter((p) => p.metodo !== salvoMetodo)
      .map((p) => p.idPago);
    if (ids.length)
      await this.pagos.update({ idPago: In(ids) }, { estado: 'ANULADO' });
  }
}
