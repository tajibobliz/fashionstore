import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Reserva, EstadoReserva } from './entities/reserva.entity';
import { DetalleReserva } from './entities/detalle-reserva.entity';
import { Sucursal } from '../branches/entities/sucursal.entity';
import { VarianteProducto } from '../catalog/entities/variante-producto.entity';
import { Inventario } from '../inventory/entities/inventario.entity';
import { MovimientoInventario } from '../inventory/entities/movimiento-inventario.entity';
import { CreateReservaDto } from './dto/create-reserva.dto';
import { UpdateEstadoReservaDto } from './dto/update-estado.dto';

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
    private readonly dataSource: DataSource,
  ) {}

  // Crea una reserva: valida stock, descuenta y guarda todo en transacción
  async create(idUsuario: number, dto: CreateReservaDto) {
    const sucursal = await this.sucursalRepo.findOne({
      where: { idSucursal: dto.idSucursal },
    });
    if (!sucursal) throw new NotFoundException(`Sucursal ${dto.idSucursal} no encontrada`);

    // Usamos transacción para que si algo falla, se revierta todo
    return this.dataSource.transaction(async (manager) => {
      // 1. Validar cada variante y su stock
      const detalles: DetalleReserva[] = [];

      for (const item of dto.detalles) {
        const variante = await manager.findOne(VarianteProducto, {
          where: { idVariante: item.idVariante },
        });
        if (!variante) {
          throw new NotFoundException(`Variante ${item.idVariante} no encontrada`);
        }

        const inventario = await manager.findOne(Inventario, {
          where: {
            sucursal: { idSucursal: dto.idSucursal },
            variante: { idVariante: item.idVariante },
          },
        });
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
        estado: 'PENDIENTE',
        usuario: { idUsuario } as any,
        sucursal,
        detalles,
      });

      return manager.save(reserva);
    });
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

  // Cambia estado (PREPARADA, ATENDIDA) - solo encargado/admin
  async updateEstado(id: number, dto: UpdateEstadoReservaDto) {
    const reserva = await this.findOne(id);

    if (reserva.estado === 'CANCELADA' || reserva.estado === 'ATENDIDA') {
      throw new BadRequestException(
        `No se puede cambiar el estado de una reserva ${reserva.estado}`,
      );
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
      // Devolver stock por cada detalle
      for (const detalle of reserva.detalles) {
        const inventario = await manager.findOne(Inventario, {
          where: {
            sucursal: { idSucursal: reserva.sucursal.idSucursal },
            variante: { idVariante: detalle.variante.idVariante },
          },
        });
        if (inventario) {
          inventario.stockReservado -= detalle.cantidad;
          inventario.stockDisponible += detalle.cantidad;
          await manager.save(inventario);

          const movimiento = manager.create(MovimientoInventario, {
            inventario,
            tipo: 'LIBERACION_RESERVA',
            cantidad: detalle.cantidad,
            referencia: `Cancelación reserva ${reserva.codigo}`,
          });
          await manager.save(movimiento);
        }
      }

      reserva.estado = 'CANCELADA';
      return manager.save(reserva);
    });
  }

  // Genera un código único tipo RES-YYYYMMDD-XXXX
  private generarCodigo(): string {
    const fecha = new Date();
    const yyyy = fecha.getFullYear();
    const mm = String(fecha.getMonth() + 1).padStart(2, '0');
    const dd = String(fecha.getDate()).padStart(2, '0');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `RES-${yyyy}${mm}${dd}-${rand}`;
  }
}