import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { Promocion } from './entities/promocion.entity';
import { Producto } from '../catalog/entities/producto.entity';
import { CreatePromocionDto } from './dto/create-promocion.dto';
import { UpdatePromocionDto } from './dto/update-promocion.dto';

@Injectable()
export class PromotionsService {
  constructor(
    @InjectRepository(Promocion)
    private readonly promocionRepo: Repository<Promocion>,
    @InjectRepository(Producto)
    private readonly productoRepo: Repository<Producto>,
  ) {}

  async create(dto: CreatePromocionDto) {
    const productos = await this.productoRepo.findBy({
      idProducto: In(dto.idsProductos),
    });

    if (productos.length !== dto.idsProductos.length) {
      throw new NotFoundException('Algunos productos no fueron encontrados');
    }

    const promocion = this.promocionRepo.create({
      nombre: dto.nombre,
      porcentaje: dto.porcentaje,
      fechaInicio: dto.fechaInicio ? new Date(dto.fechaInicio) : undefined,
      fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : undefined,
      estado: dto.estado ?? true,
      productos,
    });

    return this.promocionRepo.save(promocion);
  }

  findAll() {
    return this.promocionRepo.find();
  }

  // Solo promociones activas y dentro del rango de fechas
  async findActivas() {
    const hoy = new Date();
    return this.promocionRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.productos', 'prod')
      .where('p.estado = :estado', { estado: true })
      .andWhere('(p.fecha_inicio IS NULL OR p.fecha_inicio <= :hoy)', { hoy })
      .andWhere('(p.fecha_fin IS NULL OR p.fecha_fin >= :hoy)', { hoy })
      .getMany();
  }

  async findOne(id: number) {
    const promo = await this.promocionRepo.findOne({
      where: { idPromocion: id },
    });
    if (!promo) throw new NotFoundException(`Promoción ${id} no encontrada`);
    return promo;
  }

  // Devuelve las promociones activas de un producto específico
  async findByProducto(idProducto: number) {
    const hoy = new Date();
    return this.promocionRepo
      .createQueryBuilder('p')
      .innerJoin('p.productos', 'prod')
      .where('prod.id_producto = :idProducto', { idProducto })
      .andWhere('p.estado = :estado', { estado: true })
      .andWhere('(p.fecha_inicio IS NULL OR p.fecha_inicio <= :hoy)', { hoy })
      .andWhere('(p.fecha_fin IS NULL OR p.fecha_fin >= :hoy)', { hoy })
      .getMany();
  }

  async update(id: number, dto: UpdatePromocionDto) {
    const promo = await this.findOne(id);

    if (dto.nombre !== undefined) promo.nombre = dto.nombre;
    if (dto.porcentaje !== undefined) promo.porcentaje = dto.porcentaje;
    if (dto.fechaInicio !== undefined) promo.fechaInicio = new Date(dto.fechaInicio);
    if (dto.fechaFin !== undefined) promo.fechaFin = new Date(dto.fechaFin);
    if (dto.estado !== undefined) promo.estado = dto.estado;

    if (dto.idsProductos) {
      const productos = await this.productoRepo.findBy({
        idProducto: In(dto.idsProductos),
      });
      if (productos.length !== dto.idsProductos.length) {
        throw new NotFoundException('Algunos productos no fueron encontrados');
      }
      promo.productos = productos;
    }

    return this.promocionRepo.save(promo);
  }

  async remove(id: number) {
    const promo = await this.findOne(id);
    await this.promocionRepo.remove(promo);
    return { message: `Promoción ${id} eliminada` };
  }
}