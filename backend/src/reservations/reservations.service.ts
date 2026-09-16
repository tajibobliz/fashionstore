import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryFailedError, Repository } from 'typeorm';
import { Reserva, EstadoReserva } from './entities/reserva.entity';
import { DetalleReserva } from './entities/detalle-reserva.entity';
import { Sucursal } from '../branches/entities/sucursal.entity';
import { VarianteProducto } from '../catalog/entities/variante-producto.entity';
import { Inventario } from '../inventory/entities/inventario.entity';
import { MovimientoInventario } from '../inventory/entities/movimiento-inventario.entity';
import { CreateReservaDto } from './dto/create-reserva.dto';
import { UpdateEstadoReservaDto } from './dto/update-estado.dto';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Role } from '../auth/enums/role.enum';
import { randomUUID } from 'node:crypto';
import { Almacen } from '../warehouses/entities/almacen.entity';

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reserva)
    private readonly reservaRepo: Repository<Reserva>,
    @InjectRepository(DetalleReserva)
    private readonly detalleRepo: Repository<DetalleReserva>,
    @InjectRepository(Sucursal)
    private readonly sucursalRepo: Repository<Sucursal>,
    @InjectRepository(VarianteProducto)
    private readonly varianteRepo: Repository<VarianteProducto>,
    @InjectRepository(Inventario)
    private readonly inventarioRepo: Repository<Inventario>,
    @InjectRepository(MovimientoInventario)
    private readonly movimientoRepo: Repository<MovimientoInventario>,
    @InjectRepository(Almacen) private readonly almacenRepo: Repository<Almacen>,
    private readonly dataSource: DataSource,
  ) {}

  // Crea una reserva: valida stock, descuenta y guarda todo en transacción
  async create(idUsuario: number, dto: CreateReservaDto) {
    const findExisting = () => this.reservaRepo.findOne({ where: {
      usuario: { idUsuario }, clientRequestId: dto.clientRequestId,
    } });
    if (dto.clientRequestId) {
      const existing = await findExisting();
      if (existing) return existing;
    }
    const sucursal = await this.sucursalRepo.findOne({
      where: { idSucursal: dto.idSucursal },
    });
    if (!sucursal) throw new NotFoundException(`Sucursal ${dto.idSucursal} no encontrada`);
    const almacen = await this.almacenRepo.findOne({ where: { sucursal: { idSucursal: dto.idSucursal }, codigo: 'PRINCIPAL', estado: true } });
    if (!almacen) throw new NotFoundException('La sucursal no tiene almacén principal activo');

    // Usamos transacción para que si algo falla, se revierta todo
    return this.ejecutarIdempotente(dto.clientRequestId, findExisting, () => this.dataSource.transaction(async (manager) => {
      // 1. Validar cada variante y su stock
      const detalles: DetalleReserva[] = [];

      for (const item of this.agruparDetalles(dto.detalles)) {
        const variante = await manager.findOne(VarianteProducto, {
          where: { idVariante: item.idVariante },
        });
        if (!variante) {
          throw new NotFoundException(`Variante ${item.idVariante} no encontrada`);
        }

        const inventario = await this.bloquearInventario(
          manager, almacen.idAlmacen, item.idVariante,
        );
        if (!inventario) {
          throw new NotFoundException(
            `No hay inventario de la variante ${item.idVariante} en la sucursal ${dto.idSucursal}`,
          );
        }
        if (inventario.stockDisponible < item.cantidad) {
          throw new BadRequestException(
            `Stock insuficiente para variante ${item.idVariante}. Disponible: ${inventario.stockDisponible}, solicitado: ${item.cantidad}`,
          );
        }

        // 2. Mover stock: disponible → reservado
        inventario.stockDisponible -= item.cantidad;
        inventario.stockReservado += item.cantidad;
        await manager.save(inventario);

        // 3. Registrar movimiento
        const movimiento = manager.create(MovimientoInventario, {
          inventario,
          tipo: 'RESERVA',
          cantidad: item.cantidad,
          referencia: 'Reserva pendiente',
        });
        await manager.save(movimiento);

        // 4. Crear detalle de reserva
        const detalle = manager.create(DetalleReserva, {
          variante,
          cantidad: item.cantidad,
        });
        detalles.push(detalle);
      }

      // 5. Crear la reserva con sus detalles
      const codigo = this.generarCodigo();
      const reserva = manager.create(Reserva, {
        codigo,
        clientRequestId: dto.clientRequestId ?? null,
        estado: 'PENDIENTE',
        usuario: { idUsuario } as any,
        sucursal,
        detalles,
        almacenOrigen: almacen,
      });

      return manager.save(reserva);
    }));
  }

  findAll() {
    return this.reservaRepo.find({ order: { fechaReserva: 'DESC' } });
  }

  findByUsuario(idUsuario: number) {
    return this.reservaRepo.find({
      where: { usuario: { idUsuario } },
      order: { fechaReserva: 'DESC' },
    });
  }

  async findOne(id: number) {
    const reserva = await this.reservaRepo.findOne({
      where: { idReserva: id },
    });
    if (!reserva) throw new NotFoundException(`Reserva ${id} no encontrada`);
    return reserva;
  }
  findAllByBranches(ids: number[]) {
    if (!ids.length) return Promise.resolve([]);
    return this.reservaRepo.createQueryBuilder('r').leftJoinAndSelect('r.sucursal','s').leftJoinAndSelect('r.usuario','u').leftJoinAndSelect('r.detalles','d').leftJoinAndSelect('r.almacenOrigen','a').where('s.id_sucursal IN (:...ids)',{ids}).orderBy('r.fecha_reserva','DESC').getMany();
  }

  async findOneAuthorized(id: number, actor: AuthenticatedUser) {
    const reserva = await this.findOne(id);
    const puedeConsultarTodas = [Role.ADMIN, Role.ENCARGADO, Role.ENCARGADO_SUCURSAL, Role.CAJERO].includes(actor.rol);
    if (!puedeConsultarTodas && reserva.usuario.idUsuario !== actor.idUsuario) {
      throw new ForbiddenException('No puedes consultar esta reserva');
    }
    return reserva;
  }

  // Cambia estado (PREPARADA, ATENDIDA) - solo encargado/admin
  async updateEstado(id: number, dto: UpdateEstadoReservaDto) {
    const reserva = await this.findOne(id);

    if (reserva.estado === 'CANCELADA' || reserva.estado === 'ATENDIDA') {
      throw new BadRequestException(
        `No se puede cambiar el estado de una reserva ${reserva.estado}`,
      );
    }
    if (dto.estado === 'CANCELADA') {
      throw new BadRequestException('Usa la operación de cancelación para liberar el stock');
    }
    if (dto.estado === 'ATENDIDA') {
      throw new BadRequestException('Una reserva se atiende al registrar su venta presencial');
    }

    reserva.estado = dto.estado as EstadoReserva;
    if (dto.estado === 'ATENDIDA') {
      reserva.fechaAtencion = new Date();
    }

    return this.reservaRepo.save(reserva);
  }

  // Cancela una reserva y libera el stock reservado
  async cancel(id: number, idUsuario: number, esAdmin: boolean) {
    const reserva = await this.findOne(id);

    // Solo el dueño o un admin puede cancelar
    if (!esAdmin && reserva.usuario.idUsuario !== idUsuario) {
      throw new ForbiddenException('No puedes cancelar esta reserva');
    }

    if (reserva.estado === 'CANCELADA') {
      throw new BadRequestException('La reserva ya está cancelada');
    }
    if (reserva.estado === 'ATENDIDA') {
      throw new BadRequestException('No se puede cancelar una reserva ya atendida');
    }

    return this.dataSource.transaction(async (manager) => {
      await manager
        .createQueryBuilder(Reserva, 'reserva')
        .setLock('pessimistic_write')
        .where('reserva.id_reserva = :id', { id })
        .getOne();
      const lockedReserva = await manager.findOne(Reserva, {
        where: { idReserva: id },
      });
      if (!lockedReserva) throw new NotFoundException(`Reserva ${id} no encontrada`);
      if (!esAdmin && lockedReserva.usuario.idUsuario !== idUsuario) {
        throw new ForbiddenException('No puedes cancelar esta reserva');
      }
      if (lockedReserva.estado === 'CANCELADA') {
        throw new BadRequestException('La reserva ya está cancelada');
      }
      if (lockedReserva.estado === 'ATENDIDA') {
        throw new BadRequestException('No se puede cancelar una reserva ya atendida');
      }
      const origin = lockedReserva.almacenOrigen ?? await manager.findOne(Almacen, {
        where: { sucursal: { idSucursal: lockedReserva.sucursal.idSucursal }, codigo: 'PRINCIPAL' },
      });
      if (!origin) throw new NotFoundException('No existe almacén para liberar la reserva');

      // Devolver stock por cada detalle
      for (const detalle of [...lockedReserva.detalles].sort(
        (a, b) => a.variante.idVariante - b.variante.idVariante,
      )) {
        const inventario = await this.bloquearInventario(
          manager, origin.idAlmacen, detalle.variante.idVariante,
        );
        if (!inventario || inventario.stockReservado < detalle.cantidad) {
          throw new BadRequestException('Stock reservado inconsistente para cancelar');
        }
        if (inventario) {
          inventario.stockReservado -= detalle.cantidad;
          inventario.stockDisponible += detalle.cantidad;
          await manager.save(inventario);

          const movimiento = manager.create(MovimientoInventario, {
            inventario,
            tipo: 'LIBERACION_RESERVA',
            cantidad: detalle.cantidad,
            referencia: `Cancelación reserva ${lockedReserva.codigo}`,
          });
          await manager.save(movimiento);
        }
      }

      lockedReserva.estado = 'CANCELADA';
      return manager.save(lockedReserva);
    });
  }

  // Genera un código único tipo RES-YYYYMMDD-XXXX
  private generarCodigo(): string {
    return `RES-${randomUUID()}`;
  }

  private async ejecutarIdempotente<T>(
    clientRequestId: string | undefined,
    findExisting: () => Promise<Reserva | null>,
    operation: () => Promise<T>,
  ): Promise<T | Reserva> {
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

  private agruparDetalles(detalles: CreateReservaDto['detalles']) {
    const cantidades = new Map<number, number>();
    for (const detalle of detalles) {
      cantidades.set(detalle.idVariante, (cantidades.get(detalle.idVariante) ?? 0) + detalle.cantidad);
    }
    return [...cantidades.entries()]
      .map(([idVariante, cantidad]) => ({ idVariante, cantidad }))
      .sort((a, b) => a.idVariante - b.idVariante);
  }

  private bloquearInventario(manager: EntityManager, idAlmacen: number | undefined, idVariante: number) {
    return manager
      .createQueryBuilder(Inventario, 'inventario')
      .setLock('pessimistic_write')
      .where(idAlmacen ? 'inventario.id_almacen = :idAlmacen' : '1=0', { idAlmacen })
      .andWhere('inventario.id_variante = :idVariante', { idVariante })
      .getOne();
  }
}
