import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Inventario } from './entities/inventario.entity';
import { MovimientoInventario, TipoMovimiento } from './entities/movimiento-inventario.entity';
import { Sucursal } from '../branches/entities/sucursal.entity';
import { VarianteProducto } from '../catalog/entities/variante-producto.entity';
import { CreateInventarioDto } from './dto/create-inventario.dto';
import { UpdateInventarioDto } from './dto/update-inventario.dto';
import { CreateMovimientoDto } from './dto/create-movimiento.dto';
import { Almacen } from '../warehouses/entities/almacen.entity';

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
    @InjectRepository(Almacen) private readonly almacenRepo: Repository<Almacen>,
    private readonly dataSource: DataSource,
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
    const almacen = dto.idAlmacen
      ? await this.almacenRepo.findOne({ where: { idAlmacen: dto.idAlmacen } })
      : await this.almacenRepo.findOne({ where: { sucursal: { idSucursal: dto.idSucursal }, codigo: 'PRINCIPAL', estado: true } });
    if (!almacen) throw new NotFoundException('Almacén no encontrado');
    if (almacen.sucursal.idSucursal !== dto.idSucursal) throw new BadRequestException('El almacén no pertenece a la sucursal');

    return this.dataSource.transaction(async (manager) => {
      const inventario = manager.create(Inventario, {
        sucursal,
        variante,
        almacen,
        stockDisponible: dto.stockDisponible ?? 0,
        stockReservado: dto.stockReservado ?? 0,
      });
      const guardado = await manager.save(inventario);
      if (guardado.stockDisponible > 0 || guardado.stockReservado > 0) {
        await manager.save(manager.create(MovimientoInventario, {
          inventario: guardado,
          tipo: 'ENTRADA',
          cantidad: guardado.stockDisponible + guardado.stockReservado,
          referencia: 'Stock inicial',
        }));
      }
      return guardado;
    });
  }

  findAllInventarios() {
    return this.findInventariosByBranches();
  }

  async findOneInventario(id: number) {
    const item = await this.inventarioRepo.findOne({
      where: { idInventario: id },
    });
    if (!item) throw new NotFoundException(`Inventario ${id} no encontrado`);
    if (item.almacen.sucursal.idSucursal !== item.sucursal.idSucursal) {
      throw new NotFoundException(`Inventario ${id} no encontrado`);
    }
    return item;
  }

  async updateInventario(id: number, dto: UpdateInventarioDto) {
    return this.dataSource.transaction(async (manager) => {
      const locked = await manager
        .createQueryBuilder(Inventario, 'inventario')
        .setLock('pessimistic_write')
        .where('inventario.id_inventario = :id', { id })
        .getOne();
      if (!locked) throw new NotFoundException(`Inventario ${id} no encontrado`);
      const item = await manager.findOne(Inventario, { where: { idInventario: id } });
      if (!item) throw new NotFoundException(`Inventario ${id} no encontrado`);
      const anteriorDisponible = item.stockDisponible;
      const anteriorReservado = item.stockReservado;

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
    if (dto.idAlmacen) {
      const almacen = await this.almacenRepo.findOne({ where: { idAlmacen: dto.idAlmacen } });
      if (!almacen) throw new NotFoundException('Almacén no encontrado');
      const idSucursal = dto.idSucursal ?? item.sucursal.idSucursal;
      if (almacen.sucursal.idSucursal !== idSucursal) throw new BadRequestException('El almacén no pertenece a la sucursal');
      item.almacen = almacen;
    }
    if (item.almacen.sucursal.idSucursal !== item.sucursal.idSucursal) {
      throw new BadRequestException('El almacén no pertenece a la sucursal');
    }

    if (dto.stockDisponible !== undefined) item.stockDisponible = dto.stockDisponible;
    if (dto.stockReservado !== undefined) item.stockReservado = dto.stockReservado;

      const guardado = await manager.save(item);
      if (
        anteriorDisponible !== guardado.stockDisponible ||
        anteriorReservado !== guardado.stockReservado
      ) {
        await manager.save(manager.create(MovimientoInventario, {
          inventario: guardado,
          tipo: 'AJUSTE',
          cantidad: guardado.stockDisponible - anteriorDisponible,
          referencia: `Ajuste directo: disponible ${anteriorDisponible}->${guardado.stockDisponible}, reservado ${anteriorReservado}->${guardado.stockReservado}`,
        }));
      }
      return guardado;
    });
  }

  async removeInventario(id: number) {
    const item = await this.findOneInventario(id);
    await this.inventarioRepo.remove(item);
    return { message: `Inventario ${id} eliminado` };
  }

  // ===== MOVIMIENTOS =====

  async createMovimiento(dto: CreateMovimientoDto) {
    return this.dataSource.transaction(async (manager) => {
      const inventario = await manager
        .createQueryBuilder(Inventario, 'inventario')
        .setLock('pessimistic_write')
        .where('inventario.id_inventario = :id', { id: dto.idInventario })
        .getOne();
      if (!inventario) {
        throw new NotFoundException(`Inventario ${dto.idInventario} no encontrado`);
      }

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
        if (inventario.stockDisponible >= dto.cantidad) {
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

      if (inventario.stockDisponible < 0 || inventario.stockReservado < 0) {
        throw new BadRequestException('El stock no puede quedar negativo');
      }

      await manager.save(inventario);

      const movimiento = manager.create(MovimientoInventario, {
        inventario,
        tipo: dto.tipo as TipoMovimiento,
        cantidad: dto.cantidad,
        referencia: dto.referencia,
      });

      return manager.save(movimiento);
    });
  }

  findInventariosByBranches(ids?: number[]) {
    if (ids && !ids.length) return Promise.resolve([]);
    const qb = this.inventarioRepo.createQueryBuilder('i')
      .innerJoinAndSelect('i.sucursal', 's')
      .innerJoinAndSelect('i.almacen', 'a', 'a.id_sucursal = s.id_sucursal')
      .leftJoinAndSelect('i.variante', 'v')
      .leftJoinAndSelect('v.producto', 'p')
      .leftJoinAndSelect('p.categoria', 'cat')
      .leftJoinAndSelect('v.talla', 'ta')
      .leftJoinAndSelect('v.color', 'co');
    if (ids) qb.andWhere('i.id_sucursal IN (:...ids)', { ids });
    return qb.getMany();
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
