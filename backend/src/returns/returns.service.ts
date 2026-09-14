import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Devolucion } from './entities/devolucion.entity';
import { DetalleDevolucion } from './entities/detalle-devolucion.entity';
import { Venta } from '../sales/entities/venta.entity';
import { DetalleVenta } from '../sales/entities/detalle-venta.entity';
import { Inventario } from '../inventory/entities/inventario.entity';
import { MovimientoInventario } from '../inventory/entities/movimiento-inventario.entity';
import { CreateDevolucionDto } from './dto/create-devolucion.dto';

@Injectable()
export class ReturnsService {
  constructor(
    @InjectRepository(Devolucion)
    private readonly devolucionRepo: Repository<Devolucion>,
    @InjectRepository(DetalleDevolucion)
    private readonly detalleRepo: Repository<DetalleDevolucion>,
    @InjectRepository(Venta)
    private readonly ventaRepo: Repository<Venta>,
    @InjectRepository(DetalleVenta)
    private readonly detalleVentaRepo: Repository<DetalleVenta>,
    @InjectRepository(Inventario)
    private readonly inventarioRepo: Repository<Inventario>,
    @InjectRepository(MovimientoInventario)
    private readonly movimientoRepo: Repository<MovimientoInventario>,
    private readonly dataSource: DataSource,
  ) {}

  // Registra una devolución, devuelve stock y actualiza estado de venta
  async create(idUsuarioRegistra: number, dto: CreateDevolucionDto) {
    const venta = await this.ventaRepo.findOne({
      where: { idVenta: dto.idVenta },
    });
    if (!venta) throw new NotFoundException(`Venta ${dto.idVenta} no encontrada`);

    if (venta.estado !== 'PAGADA' && venta.estado !== 'DEVUELTA_PARCIAL') {
      throw new BadRequestException(
        `Solo se puede devolver una venta PAGADA. Estado actual: ${venta.estado}`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const detalles: DetalleDevolucion[] = [];
      let cantidadTotalDevuelta = 0;
      let cantidadTotalVenta = 0;

      // Sumar cantidades totales de la venta original
      for (const dv of venta.detalles) {
        cantidadTotalVenta += dv.cantidad;
      }

      // Procesar cada item a devolver
      for (const item of dto.detalles) {
        const detalleVenta = await manager.findOne(DetalleVenta, {
          where: { idDetalleVenta: item.idDetalleVenta },
        });
        if (!detalleVenta) {
          throw new NotFoundException(
            `Detalle de venta ${item.idDetalleVenta} no encontrado`,
          );
        }

        // Verificar que el detalle pertenezca a la venta
        const perteneceALaVenta = venta.detalles.some(
          (d) => d.idDetalleVenta === item.idDetalleVenta,
        );
        if (!perteneceALaVenta) {
          throw new BadRequestException(
            `El detalle ${item.idDetalleVenta} no pertenece a esta venta`,
          );
        }

        if (item.cantidad > detalleVenta.cantidad) {
          throw new BadRequestException(
            `No puedes devolver ${item.cantidad}, la venta original solo tiene ${detalleVenta.cantidad}`,
          );
        }

        cantidadTotalDevuelta += item.cantidad;

        // Devolver stock al inventario
        const inventario = await manager.findOne(Inventario, {
          where: {
            sucursal: { idSucursal: venta.sucursal.idSucursal },
            variante: { idVariante: detalleVenta.variante.idVariante },
          },
        });
        if (inventario) {
          inventario.stockDisponible += item.cantidad;
          await manager.save(inventario);

          const movimiento = manager.create(MovimientoInventario, {
            inventario,
            tipo: 'DEVOLUCION',
            cantidad: item.cantidad,
            referencia: `Devolución venta ${venta.numeroComprobante}`,
          });
          await manager.save(movimiento);
        }

        const detalleDev = manager.create(DetalleDevolucion, {
          detalleVenta,
          cantidad: item.cantidad,
        });
        detalles.push(detalleDev);
      }

      // Crear la devolución
      const devolucion = manager.create(Devolucion, {
        venta,
        motivo: dto.motivo,
        usuarioRegistra: { idUsuario: idUsuarioRegistra } as any,
        detalles,
      });

      const devolucionGuardada = await manager.save(devolucion);

      // Actualizar estado de la venta
      if (cantidadTotalDevuelta >= cantidadTotalVenta) {
        venta.estado = 'DEVUELTA';
      } else {
        venta.estado = 'DEVUELTA_PARCIAL';
      }
      await manager.save(venta);

      return devolucionGuardada;
    });
  }

  findAll() {
    return this.devolucionRepo.find({ order: { fecha: 'DESC' } });
  }

  findByVenta(idVenta: number) {
    return this.devolucionRepo.find({
      where: { venta: { idVenta } },
      order: { fecha: 'DESC' },
    });
  }

  async findOne(id: number) {
    const dev = await this.devolucionRepo.findOne({
      where: { idDevolucion: id },
    });
    if (!dev) throw new NotFoundException(`Devolución ${id} no encontrada`);
    return dev;
  }
}