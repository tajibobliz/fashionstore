import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Venta, EstadoVenta } from './entities/venta.entity';
import { DetalleVenta } from './entities/detalle-venta.entity';
import { Sucursal } from '../branches/entities/sucursal.entity';
import { VarianteProducto } from '../catalog/entities/variante-producto.entity';
import { Producto } from '../catalog/entities/producto.entity';
import { Inventario } from '../inventory/entities/inventario.entity';
import { MovimientoInventario } from '../inventory/entities/movimiento-inventario.entity';
import { Carrito } from '../cart/entities/carrito.entity';
import { CreateVentaCarritoDto } from './dto/create-venta-carrito.dto';
import { CreateVentaPresencialDto } from './dto/create-venta-presencial.dto';

@Injectable()
export class SalesService {
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
    private readonly dataSource: DataSource,
  ) {}

  // Cliente convierte su carrito en venta DIGITAL pendiente
  async createFromCart(idUsuario: number, dto: CreateVentaCarritoDto) {
    const carrito = await this.carritoRepo.findOne({
      where: { usuario: { idUsuario }, estado: 'ACTIVO' },
    });

    if (!carrito || carrito.detalles.length === 0) {
      throw new BadRequestException('No tienes items en el carrito');
    }

    const sucursal = await this.sucursalRepo.findOne({
      where: { idSucursal: dto.idSucursal },
    });
    if (!sucursal) throw new NotFoundException('Sucursal no encontrada');

    return this.dataSource.transaction(async (manager) => {
      let total = 0;
      const detalles: DetalleVenta[] = [];

      for (const item of carrito.detalles) {
        const subtotal = Number(item.precio) * item.cantidad;
        total += subtotal;

        const detalle = manager.create(DetalleVenta, {
          variante: item.variante,
          cantidad: item.cantidad,
          precioUnitario: item.precio,
          subtotal,
        });
        detalles.push(detalle);
      }

      const venta = manager.create(Venta, {
        tipoVenta: 'DIGITAL',
        estado: 'PENDIENTE',
        total,
        numeroComprobante: this.generarComprobante('DIG'),
        usuario: { idUsuario } as any,
        sucursal,
        detalles,
      });

      const ventaGuardada = await manager.save(venta);

      // Marcar carrito como convertido
      carrito.estado = 'CONVERTIDO';
      await manager.save(carrito);

      return ventaGuardada;
    });
  }

  // Cajero registra venta presencial (descuenta stock inmediatamente)
  async createPresencial(idCajero: number, dto: CreateVentaPresencialDto) {
    const sucursal = await this.sucursalRepo.findOne({
      where: { idSucursal: dto.idSucursal },
    });
    if (!sucursal) throw new NotFoundException('Sucursal no encontrada');

    return this.dataSource.transaction(async (manager) => {
      let total = 0;
      const detalles: DetalleVenta[] = [];

      for (const item of dto.detalles) {
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
        const inventario = await manager.findOne(Inventario, {
          where: {
            sucursal: { idSucursal: dto.idSucursal },
            variante: { idVariante: item.idVariante },
          },
        });
        if (!inventario) {
          throw new NotFoundException(
            `No hay inventario de variante ${item.idVariante} en esta sucursal`,
          );
        }

        const disponibleTotal =
          inventario.stockDisponible + inventario.stockReservado;
        if (disponibleTotal < item.cantidad) {
          throw new BadRequestException(
            `Stock insuficiente para variante ${item.idVariante}`,
          );
        }

        // Descontar stock (primero de reservado, luego de disponible)
        let restante = item.cantidad;
        if (inventario.stockReservado >= restante) {
          inventario.stockReservado -= restante;
        } else {
          restante -= inventario.stockReservado;
          inventario.stockReservado = 0;
          inventario.stockDisponible -= restante;
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

        const subtotal = Number(producto.precio) * item.cantidad;
        total += subtotal;

        const detalle = manager.create(DetalleVenta, {
          variante,
          cantidad: item.cantidad,
          precioUnitario: producto.precio,
          subtotal,
        });
        detalles.push(detalle);
      }

      const venta = manager.create(Venta, {
        tipoVenta: 'PRESENCIAL',
        estado: 'PAGADA', // presencial se paga en el momento
        total,
        numeroComprobante: this.generarComprobante('PRE'),
        usuario: dto.idUsuario ? ({ idUsuario: dto.idUsuario } as any) : null,
        sucursal,
        cajero: { idUsuario: idCajero } as any,
        reserva: dto.idReserva ? ({ idReserva: dto.idReserva } as any) : null,
        detalles,
      });

      return manager.save(venta);
    });
  }

  // Confirma una venta digital (se llama cuando el pago se aprueba)
  async confirmar(id: number) {
    const venta = await this.findOne(id);

    if (venta.estado !== 'PENDIENTE') {
      throw new BadRequestException(
        `No se puede confirmar una venta en estado ${venta.estado}`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      // Descontar stock por cada item
      for (const detalle of venta.detalles) {
        const inventario = await manager.findOne(Inventario, {
          where: {
            sucursal: { idSucursal: venta.sucursal.idSucursal },
            variante: { idVariante: detalle.variante.idVariante },
          },
        });
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
      return manager.save(venta);
    });
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

  findAll() {
    return this.ventaRepo.find({ order: { fecha: 'DESC' } });
  }

  findByUsuario(idUsuario: number) {
    return this.ventaRepo.find({
      where: { usuario: { idUsuario } },
      order: { fecha: 'DESC' },
    });
  }

  async findOne(id: number) {
    const venta = await this.ventaRepo.findOne({ where: { idVenta: id } });
    if (!venta) throw new NotFoundException(`Venta ${id} no encontrada`);
    return venta;
  }

  private generarComprobante(prefijo: string): string {
    const fecha = new Date();
    const yyyy = fecha.getFullYear();
    const mm = String(fecha.getMonth() + 1).padStart(2, '0');
    const dd = String(fecha.getDate()).padStart(2, '0');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefijo}-${yyyy}${mm}${dd}-${rand}`;
  }
}