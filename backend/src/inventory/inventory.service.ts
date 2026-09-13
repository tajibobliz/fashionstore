import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inventario } from './entities/inventario.entity';
import { MovimientoInventario, TipoMovimiento } from './entities/movimiento-inventario.entity';
import { Sucursal } from '../branches/entities/sucursal.entity';
import { VarianteProducto } from '../catalog/entities/variante-producto.entity';
import { CreateInventarioDto } from './dto/create-inventario.dto';
import { UpdateInventarioDto } from './dto/update-inventario.dto';
import { CreateMovimientoDto } from './dto/create-movimiento.dto';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(Inventario)
    private readonly inventarioRepo: Repository<Inventario>,
    @InjectRepository(MovimientoInventario)
    private readonly movimientoRepo: Repository<MovimientoInventario>,
    @InjectRepository(Sucursal)
    private readonly sucursalRepo: Repository<Sucursal>,
    @InjectRepository(VarianteProducto)
    private readonly varianteRepo: Repository<VarianteProducto>,
  ) {}

  // ===== INVENTARIOS =====

  async createInventario(dto: CreateInventarioDto) {
    const sucursal = await this.sucursalRepo.findOne({
      where: { idSucursal: dto.idSucursal },
    });
    if (!sucursal) throw new NotFoundException(`Sucursal ${dto.idSucursal} no encontrada`);

    const variante = await this.varianteRepo.findOne({
      where: { idVariante: dto.idVariante },
    });
    if (!variante) throw new NotFoundException(`Variante ${dto.idVariante} no encontrada`);

    const inventario = this.inventarioRepo.create({
      sucursal,
      variante,
      stockDisponible: dto.stockDisponible ?? 0,
      stockReservado: dto.stockReservado ?? 0,
    });

    return this.inventarioRepo.save(inventario);
  }

  findAllInventarios() {
    return this.inventarioRepo.find();
  }

  async findOneInventario(id: number) {
    const item = await this.inventarioRepo.findOne({
      where: { idInventario: id },
    });
    if (!item) throw new NotFoundException(`Inventario ${id} no encontrado`);
    return item;
  }

  async updateInventario(id: number, dto: UpdateInventarioDto) {
    const item = await this.findOneInventario(id);

    if (dto.idSucursal) {
      const sucursal = await this.sucursalRepo.findOne({
        where: { idSucursal: dto.idSucursal },
      });
      if (!sucursal) throw new NotFoundException(`Sucursal ${dto.idSucursal} no encontrada`);
      item.sucursal = sucursal;
    }

    if (dto.idVariante) {
      const variante = await this.varianteRepo.findOne({
        where: { idVariante: dto.idVariante },
      });
      if (!variante) throw new NotFoundException(`Variante ${dto.idVariante} no encontrada`);
      item.variante = variante;
    }

    if (dto.stockDisponible !== undefined) item.stockDisponible = dto.stockDisponible;
    if (dto.stockReservado !== undefined) item.stockReservado = dto.stockReservado;

    return this.inventarioRepo.save(item);
  }

  async removeInventario(id: number) {
    const item = await this.findOneInventario(id);
    await this.inventarioRepo.remove(item);
    return { message: `Inventario ${id} eliminado` };
  }

  // ===== MOVIMIENTOS =====

  async createMovimiento(dto: CreateMovimientoDto) {
    const inventario = await this.findOneInventario(dto.idInventario);

    // Aplicar el cambio al stock según el tipo de movimiento
    switch (dto.tipo) {
      case 'ENTRADA':
      case 'DEVOLUCION':
        inventario.stockDisponible += dto.cantidad;
        break;
      case 'RESERVA':
        if (inventario.stockDisponible < dto.cantidad) {
          throw new BadRequestException('Stock disponible insuficiente para reservar');
        }
        inventario.stockDisponible -= dto.cantidad;
        inventario.stockReservado += dto.cantidad;
        break;
      case 'LIBERACION_RESERVA':
        if (inventario.stockReservado < dto.cantidad) {
          throw new BadRequestException('Stock reservado insuficiente para liberar');
        }
        inventario.stockReservado -= dto.cantidad;
        inventario.stockDisponible += dto.cantidad;
        break;
      case 'VENTA':
        if (inventario.stockReservado >= dto.cantidad) {
          inventario.stockReservado -= dto.cantidad;
        } else if (inventario.stockDisponible >= dto.cantidad) {
          inventario.stockDisponible -= dto.cantidad;
        } else {
          throw new BadRequestException('Stock insuficiente para venta');
        }
        break;
      case 'AJUSTE':
        // Ajuste manual: se acepta cualquier valor (positivo o negativo lo manejas afuera)
        inventario.stockDisponible += dto.cantidad;
        break;
    }

    await this.inventarioRepo.save(inventario);

    const movimiento = this.movimientoRepo.create({
      inventario,
      tipo: dto.tipo as TipoMovimiento,
      cantidad: dto.cantidad,
      referencia: dto.referencia,
    });

    return this.movimientoRepo.save(movimiento);
  }

  findAllMovimientos() {
    return this.movimientoRepo.find({
      order: { fecha: 'DESC' },
    });
  }

  async findOneMovimiento(id: number) {
    const item = await this.movimientoRepo.findOne({
      where: { idMovimiento: id },
    });
    if (!item) throw new NotFoundException(`Movimiento ${id} no encontrado`);
    return item;
  }
}