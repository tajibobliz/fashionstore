import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryFailedError, Repository } from 'typeorm';
import { Venta } from './entities/venta.entity';
import { DetalleVenta } from './entities/detalle-venta.entity';
import { Sucursal } from '../branches/entities/sucursal.entity';
import { VarianteProducto } from '../catalog/entities/variante-producto.entity';
import { Producto } from '../catalog/entities/producto.entity';
import { Inventario } from '../inventory/entities/inventario.entity';
import { MovimientoInventario } from '../inventory/entities/movimiento-inventario.entity';
import { Carrito } from '../cart/entities/carrito.entity';
import { CreateVentaCarritoDto } from './dto/create-venta-carrito.dto';
import { CreateVentaPresencialDto } from './dto/create-venta-presencial.dto';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Role } from '../auth/enums/role.enum';
import { Reserva } from '../reservations/entities/reserva.entity';
import { randomUUID } from 'node:crypto';
import { Almacen } from '../warehouses/entities/almacen.entity';
import { PosService } from '../pos/pos.service';
import { PromotionsService } from '../promotions/promotions.service';
import { toMoney } from '../common/utils/money.util';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    @InjectRepository(Venta)
    private readonly ventaRepo: Repository<Venta>,
    @InjectRepository(DetalleVenta)
    private readonly detalleRepo: Repository<DetalleVenta>,
    @InjectRepository(Sucursal)
    private readonly sucursalRepo: Repository<Sucursal>,
    @InjectRepository(VarianteProducto)
    private readonly varianteRepo: Repository<VarianteProducto>,
    @InjectRepository(Producto)
    private readonly productoRepo: Repository<Producto>,
    @InjectRepository(Inventario)
    private readonly inventarioRepo: Repository<Inventario>,
    @InjectRepository(MovimientoInventario)
    private readonly movimientoRepo: Repository<MovimientoInventario>,
    @InjectRepository(Carrito)
    private readonly carritoRepo: Repository<Carrito>,
    @InjectRepository(Almacen) private readonly almacenRepo: Repository<Almacen>,
    private readonly posService: PosService,
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
    @Optional() private readonly promotionsService?: PromotionsService,
  ) {}

  // Cliente convierte su carrito en venta DIGITAL pendiente
  async createFromCart(idUsuario: number, dto: CreateVentaCarritoDto) {
    const findExisting = () => this.ventaRepo.findOne({ where: {
      usuario: { idUsuario }, clientRequestId: dto.clientRequestId, tipoVenta: 'DIGITAL',
    } });
    if (dto.clientRequestId) {
      const existing = await findExisting();
      if (existing) return existing;
    }
    const carrito = await this.carritoRepo.findOne({
      where: { usuario: { idUsuario }, sucursal: { idSucursal: dto.idSucursal }, estado: 'ACTIVO' },
    });

    if (!carrito || carrito.detalles.length === 0) {
      throw new BadRequestException('No tienes items en el carrito');
    }

    const sucursal = await this.sucursalRepo.findOne({
      where: { idSucursal: dto.idSucursal },
    });
    if (!sucursal) throw new NotFoundException('Sucursal no encontrada');
    const almacen = await this.findPrincipal(dto.idSucursal);

    return this.ejecutarIdempotente(dto.clientRequestId, findExisting, () => this.dataSource.transaction(async (manager) => {
      let total = 0;
      const detalles: DetalleVenta[] = [];

      for (const item of carrito.detalles) {
        const producto = await manager.findOne(Producto, {
          where: { idProducto: item.variante.producto.idProducto },
        });
        if (!producto) throw new NotFoundException('Producto no encontrado');
        const precio = await this.resolverPrecio(producto, item.cantidad, dto.modalidadComercial);
        const subtotal = toMoney(precio * item.cantidad);
        total = toMoney(total + subtotal);

        const detalle = manager.create(DetalleVenta, {
        variante: item.variante,
        cantidad: item.cantidad,
        precioUnitario: precio,
        subtotal,
        });
        detalles.push(detalle);
      }

      const venta = manager.create(Venta, {
        tipoVenta: 'DIGITAL',
        modalidadComercial: dto.modalidadComercial ?? 'MINORISTA',
        clientRequestId: dto.clientRequestId ?? null,
        estado: 'PENDIENTE',
        total,
        numeroComprobante: this.generarComprobante('DIG'),
        usuario: { idUsuario } as any,
        sucursal,
        almacen,
        detalles,
      });

      const ventaGuardada = await manager.save(venta);

      // Marcar carrito como convertido
      carrito.estado = 'CONVERTIDO';
      await manager.save(carrito);

      return ventaGuardada;
    }));
  }

  // Cajero registra venta presencial (descuenta stock inmediatamente)
  async createPresencial(actor: AuthenticatedUser, dto: CreateVentaPresencialDto) {
    const sucursal = await this.sucursalRepo.findOne({
      where: { idSucursal: dto.idSucursal },
    });
    if (!sucursal) throw new NotFoundException('Sucursal no encontrada');
    const turno = await this.posService.resolverTurno(actor, dto.idSucursal, dto.idCaja);
    const findExisting = () => this.ventaRepo.findOne({ where: {
      cajero: { idUsuario: actor.idUsuario }, turno: { idTurno: turno.idTurno },
      clientRequestId: dto.clientRequestId, tipoVenta: 'PRESENCIAL',
    } });
    if (dto.clientRequestId) {
      const existing = await findExisting();
      if (existing) return existing;
    }
    let almacen = turno.caja.almacenDefault ?? await this.findPrincipal(dto.idSucursal);

    return this.ejecutarIdempotente(dto.clientRequestId, findExisting, () => this.dataSource.transaction(async (manager) => {
      let total = 0;
      const detalles: DetalleVenta[] = [];
      let reserva: Reserva | null = null;

      if (dto.idReserva) {
        await manager
          .createQueryBuilder(Reserva, 'reserva')
          .setLock('pessimistic_write')
          .where('reserva.id_reserva = :id', { id: dto.idReserva })
          .getOne();
        reserva = await manager.findOne(Reserva, {
          where: { idReserva: dto.idReserva },
        });
        if (!reserva) throw new NotFoundException('Reserva no encontrada');
        if (!['PENDIENTE', 'PREPARADA'].includes(reserva.estado)) {
          throw new BadRequestException(`La reserva está en estado ${reserva.estado}`);
        }
        if (reserva.sucursal.idSucursal !== dto.idSucursal) {
          throw new BadRequestException('La reserva pertenece a otra sucursal');
        }
        if (!dto.idUsuario || reserva.usuario.idUsuario !== dto.idUsuario) {
          throw new BadRequestException('La reserva no pertenece al cliente de la venta');
        }
        this.validarDetallesDeReserva(dto.detalles, reserva);
        if (!reserva.almacenOrigen) throw new BadRequestException('La reserva no tiene almacén de origen');
        almacen = reserva.almacenOrigen;
      }

      for (const item of this.agruparDetalles(dto.detalles)) {
        const variante = await manager.findOne(VarianteProducto, {
          where: { idVariante: item.idVariante },
        });
        if (!variante) {
          throw new NotFoundException(`Variante ${item.idVariante} no encontrada`);
        }

        const producto = await manager.findOne(Producto, {
          where: { idProducto: variante.producto.idProducto },
        });
        if (!producto) throw new NotFoundException('Producto no encontrado');

        // Verificar stock disponible en esa sucursal
        const inventario = await this.bloquearInventario(
          manager, almacen.idAlmacen, item.idVariante,
        );
        if (!inventario) {
          throw new NotFoundException(
            `No hay inventario de variante ${item.idVariante} en esta sucursal`,
          );
        }

        const stockUtilizable = reserva
          ? inventario.stockReservado
          : inventario.stockDisponible;
        if (stockUtilizable < item.cantidad) {
          throw new BadRequestException(
            `Stock insuficiente para variante ${item.idVariante}`,
          );
        }

        if (reserva) {
          inventario.stockReservado -= item.cantidad;
        } else {
          inventario.stockDisponible -= item.cantidad;
        }
        await manager.save(inventario);

        // Registrar movimiento
        const movimiento = manager.create(MovimientoInventario, {
          inventario,
          tipo: 'VENTA',
          cantidad: item.cantidad,
          referencia: 'Venta presencial',
        });
        await manager.save(movimiento);

       const precio = await this.resolverPrecio(producto, item.cantidad, dto.modalidadComercial);
const subtotal = toMoney(precio * item.cantidad);
total = toMoney(total + subtotal);

const detalle = manager.create(DetalleVenta, {
  variante,
  cantidad: item.cantidad,
  precioUnitario: precio,
  subtotal,
});
        detalles.push(detalle);
      }

      const venta = manager.create(Venta, {
        tipoVenta: 'PRESENCIAL',
        modalidadComercial: dto.modalidadComercial ?? 'MINORISTA',
        clientRequestId: dto.clientRequestId ?? null,
        estado: 'PAGADA', // presencial se paga en el momento
        total,
        numeroComprobante: this.generarComprobante('PRE'),
        usuario: dto.idUsuario ? ({ idUsuario: dto.idUsuario } as any) : null,
        sucursal,
        cajero: { idUsuario: actor.idUsuario } as any,
        reserva: reserva ?? undefined,
        almacen,
        turno,
        detalles,
      });

      const ventaGuardada = await manager.save(venta);
      if (reserva) {
        reserva.estado = 'ATENDIDA';
        reserva.fechaAtencion = new Date();
        await manager.save(reserva);
      }
      return ventaGuardada;
    }));
  }

  // Confirma una venta digital (se llama cuando el pago se aprueba)
  async confirmar(id: number) {
    return this.dataSource.transaction((manager) =>
      this.confirmarEnTransaccion(manager, id),
    );
  }

  async confirmarEnTransaccion(manager: EntityManager, id: number) {
      await manager
        .createQueryBuilder(Venta, 'venta')
        .setLock('pessimistic_write')
        .where('venta.id_venta = :id', { id })
        .getOne();
      const venta = await manager.findOne(Venta, { where: { idVenta: id } });
      if (!venta) throw new NotFoundException(`Venta ${id} no encontrada`);
      if (venta.estado !== 'PENDIENTE') {
        throw new BadRequestException(
          `No se puede confirmar una venta en estado ${venta.estado}`,
        );
      }

      for (const detalle of [...venta.detalles].sort(
        (a, b) => a.variante.idVariante - b.variante.idVariante,
      )) {
        const almacen = venta.almacen ?? await manager.findOne(Almacen,{where:{sucursal:{idSucursal:venta.sucursal.idSucursal},codigo:'PRINCIPAL'}});
        if (!almacen) throw new NotFoundException('No existe almacén de origen para la venta');
        const inventario = await this.bloquearInventario(
          manager, almacen.idAlmacen, detalle.variante.idVariante,
        );
        if (!inventario || inventario.stockDisponible < detalle.cantidad) {
          throw new BadRequestException(
            `Stock insuficiente al confirmar venta ${venta.idVenta}`,
          );
        }

        inventario.stockDisponible -= detalle.cantidad;
        await manager.save(inventario);

        const movimiento = manager.create(MovimientoInventario, {
          inventario,
          tipo: 'VENTA',
          cantidad: detalle.cantidad,
          referencia: `Venta ${venta.numeroComprobante}`,
        });
        await manager.save(movimiento);
      }

      venta.estado = 'PAGADA';
      const saved = await manager.save(venta);
      this.notificarVentaPagada(saved);
      return saved;
  }

  // Push "compra confirmada". Se llama tanto desde confirmar() (venta digital confirmada directamente)
  // como desde PaymentsService (pago aprobado vía la pasarela): confirmarEnTransaccion() es el único
  // punto que comparten ambos caminos. No se espera (fire-and-forget) y enviarPush() nunca lanza; el
  // try/catch cubre errores sincrónicos al construir el mensaje.
  private notificarVentaPagada(venta: Venta) {
    try {
      const token = venta.usuario?.pushToken;
      if (!token) return;
      void this.notificationsService.enviarPush(
        token,
        'Compra confirmada',
        `Tu compra Nº ${venta.idVenta} fue procesada correctamente. Total: Bs ${Number(venta.total).toFixed(2)}`,
        { tipo: 'venta', idVenta: venta.idVenta },
      );
    } catch (error) {
      this.logger.error(`No se pudo notificar la venta ${venta.idVenta}: ${(error as Error).message}`);
    }
  }

  // Cancela una venta pendiente
  async cancelar(id: number) {
    const venta = await this.findOne(id);

    if (venta.estado !== 'PENDIENTE') {
      throw new BadRequestException(
        `No se puede cancelar una venta en estado ${venta.estado}`,
      );
    }

    venta.estado = 'CANCELADA';
    return this.ventaRepo.save(venta);
  }

  findByTurnoForCashier(idTurno: number, idUsuario: number) {
    return this.ventaRepo.createQueryBuilder('v')
      .leftJoinAndSelect('v.usuario', 'cliente')
      .leftJoinAndSelect('v.sucursal', 's')
      .leftJoinAndSelect('v.almacen', 'a')
      .leftJoinAndSelect('v.turno', 't')
      .leftJoinAndSelect('v.detalles', 'd')
      .leftJoinAndSelect('d.variante', 'vr')
      .leftJoinAndSelect('vr.producto', 'p')
      .where('t.id_turno = :idTurno', { idTurno })
      .andWhere('v.id_cajero = :idUsuario', { idUsuario })
      .andWhere("v.tipo_venta = 'PRESENCIAL'")
      .orderBy('v.fecha', 'DESC')
      .getMany();
  }

  findAll() {
    return this.ventaRepo.find({ order: { fecha: 'DESC' } });
  }

  findByUsuario(idUsuario: number) {
    return this.ventaRepo.find({
      where: { usuario: { idUsuario } },
      order: { fecha: 'DESC' },
    });
  }

  buscarPorCliente(cliente: string, actor: AuthenticatedUser) {
    const qb = this.ventaRepo.createQueryBuilder('v').leftJoinAndSelect('v.usuario','cliente').leftJoinAndSelect('v.cajero','cajero').leftJoinAndSelect('v.sucursal','sucursal').leftJoinAndSelect('v.almacen','almacen').leftJoinAndSelect('v.detalles','detalles').leftJoinAndSelect('detalles.variante','variante').leftJoinAndSelect('variante.producto','producto').where("v.tipo_venta = 'PRESENCIAL'" ).andWhere('(LOWER(cliente.nombre) LIKE LOWER(:q) OR LOWER(cliente.email) LIKE LOWER(:q))',{q: `%${cliente}%`});
    if (actor.rol === Role.CAJERO) qb.andWhere('cajero.id_usuario = :idUsuario',{idUsuario:actor.idUsuario});
    return qb.orderBy('v.fecha','DESC').take(20).getMany();
  }

  async findOne(id: number) {
    const venta = await this.ventaRepo.findOne({ where: { idVenta: id } });
    if (!venta) throw new NotFoundException(`Venta ${id} no encontrada`);
    return venta;
  }
  findAllByBranches(ids:number[]){if(!ids.length)return Promise.resolve([]);return this.ventaRepo.createQueryBuilder('v').leftJoinAndSelect('v.sucursal','s').leftJoinAndSelect('v.almacen','a').leftJoinAndSelect('v.turno','t').where('s.id_sucursal IN (:...ids)',{ids}).orderBy('v.fecha','DESC').getMany();}

  async findOneAuthorized(id: number, actor: AuthenticatedUser) {
    const venta = await this.findOne(id);
    const puedeConsultarTodas = [Role.ADMIN, Role.ENCARGADO, Role.ENCARGADO_SUCURSAL, Role.CAJERO].includes(actor.rol);
    if (!puedeConsultarTodas && venta.usuario?.idUsuario !== actor.idUsuario) {
      throw new ForbiddenException('No puedes consultar esta venta');
    }
    return venta;
  }

  async cancelarAuthorized(id: number, actor: AuthenticatedUser) {
    const venta = await this.findOne(id);
    const puedeCancelarTodas = [Role.ADMIN, Role.ENCARGADO, Role.ENCARGADO_SUCURSAL, Role.CAJERO].includes(actor.rol);
    if (!puedeCancelarTodas && venta.usuario?.idUsuario !== actor.idUsuario) {
      throw new ForbiddenException('No puedes cancelar esta venta');
    }
    return this.cancelar(id);
  }

  private generarComprobante(prefijo: string): string {
    return `${prefijo}-${randomUUID()}`;
  }

  private async resolverPrecio(producto: Producto, cantidad: number, modalidad = 'MINORISTA'): Promise<number> {
    let precio = Number(producto.precio);
    if (modalidad === 'MAYORISTA' && (producto.precioMayorista === null || producto.precioMayorista === undefined ||
        producto.cantidadMinimaMayorista === null || producto.cantidadMinimaMayorista === undefined)) {
      throw new BadRequestException(`El producto ${producto.idProducto} no tiene configuración mayorista`);
    }
    if (modalidad === 'MAYORISTA' && cantidad < producto.cantidadMinimaMayorista!) {
      throw new BadRequestException(`El producto ${producto.idProducto} requiere al menos ${producto.cantidadMinimaMayorista} unidades para venta mayorista`);
    }
    if (modalidad === 'MAYORISTA') precio = Number(producto.precioMayorista);
    const promociones = this.promotionsService ? await this.promotionsService.findByProducto(producto.idProducto) : [];
    const porcentaje = promociones.length ? Math.max(...promociones.map((p) => Number(p.porcentaje))) : 0;
    return Number((precio * (1 - porcentaje / 100)).toFixed(2));
  }

  private async ejecutarIdempotente<T>(
    clientRequestId: string | undefined,
    findExisting: () => Promise<Venta | null>,
    operation: () => Promise<T>,
  ): Promise<T | Venta> {
    try {
      return await operation();
    } catch (error) {
      if (clientRequestId && error instanceof QueryFailedError &&
          (error as QueryFailedError & { driverError?: { code?: string } }).driverError?.code === '23505') {
        const existing = await findExisting();
        if (existing) return existing;
      }
      throw error;
    }
  }

  private agruparDetalles(detalles: CreateVentaPresencialDto['detalles']) {
    const cantidades = new Map<number, number>();
    for (const detalle of detalles) {
      cantidades.set(detalle.idVariante, (cantidades.get(detalle.idVariante) ?? 0) + detalle.cantidad);
    }
    return [...cantidades.entries()]
      .map(([idVariante, cantidad]) => ({ idVariante, cantidad }))
      .sort((a, b) => a.idVariante - b.idVariante);
  }

  private validarDetallesDeReserva(
    detalles: CreateVentaPresencialDto['detalles'],
    reserva: Reserva,
  ) {
    const solicitados = this.agruparDetalles(detalles);
    const reservados = [...reserva.detalles]
      .map((detalle) => ({
        idVariante: detalle.variante.idVariante,
        cantidad: detalle.cantidad,
      }))
      .sort((a, b) => a.idVariante - b.idVariante);
    if (JSON.stringify(solicitados) !== JSON.stringify(reservados)) {
      throw new BadRequestException('La venta debe coincidir exactamente con la reserva');
    }
  }

  private bloquearInventario(manager: EntityManager, idAlmacen: number, idVariante: number) {
    return manager
      .createQueryBuilder(Inventario, 'inventario')
      .setLock('pessimistic_write')
      .where('inventario.id_almacen = :idAlmacen', { idAlmacen })
      .andWhere('inventario.id_variante = :idVariante', { idVariante })
      .getOne();
  }
  private async findPrincipal(idSucursal:number){const a=await this.almacenRepo.findOne({where:{sucursal:{idSucursal},codigo:'PRINCIPAL',estado:true}});if(!a)throw new NotFoundException('La sucursal no tiene almacén principal activo');return a;}
}
