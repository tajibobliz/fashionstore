import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Promocion } from './entities/promocion.entity';
import { Producto } from '../catalog/entities/producto.entity';
import { CreatePromocionDto } from './dto/create-promocion.dto';
import { UpdatePromocionDto } from './dto/update-promocion.dto';
import { Categoria } from '../catalog/entities/categoria.entity';
import { Temporada } from '../catalog/entities/temporada.entity';

@Injectable()
export class PromotionsService {
  constructor(
    @InjectRepository(Promocion)
    private readonly promocionRepo: Repository<Promocion>,
    @InjectRepository(Producto)
    private readonly productoRepo: Repository<Producto>,
    @InjectRepository(Categoria) private readonly categoriaRepo: Repository<Categoria>,
    @InjectRepository(Temporada) private readonly temporadaRepo: Repository<Temporada>,
  ) {}

  async create(dto: CreatePromocionDto) {
    const idsProductos = dto.idsProductos ?? [], idsCategorias = dto.idsCategorias ?? [], idsTemporadas = dto.idsTemporadas ?? [];
    if (!idsProductos.length && !idsCategorias.length && !idsTemporadas.length) throw new BadRequestException('La promoción debe asociarse a productos, categorías o temporadas');
    const productos = idsProductos.length ? await this.productoRepo.findBy({ idProducto: In(idsProductos) }) : [];
    const categorias = idsCategorias.length ? await this.categoriaRepo.findBy({ idCategoria: In(idsCategorias) }) : [];
    const temporadas = idsTemporadas.length ? await this.temporadaRepo.findBy({ idTemporada: In(idsTemporadas) }) : [];

    if (productos.length !== idsProductos.length || categorias.length !== idsCategorias.length || temporadas.length !== idsTemporadas.length) {
      throw new NotFoundException('Algunos productos no fueron encontrados');
    }

    const promocion = this.promocionRepo.create({
      nombre: dto.nombre,
      porcentaje: dto.porcentaje,
      fechaInicio: dto.fechaInicio ? new Date(dto.fechaInicio) : undefined,
      fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : undefined,
      estado: dto.estado ?? true,
      productos,
      categorias,
      temporadas,
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
      .leftJoinAndSelect('p.categorias', 'cat')
      .leftJoinAndSelect('p.temporadas', 'temp')
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
      .leftJoin('p.productos', 'prod')
      .leftJoin('p.categorias', 'cat')
      .leftJoin('p.temporadas', 'temp')
      .leftJoin(Producto, 'target', 'target.id_producto=:idProducto', { idProducto })
      .leftJoin('target.coleccion', 'col')
      .where('(prod.id_producto=:idProducto OR cat.id_categoria=target.id_categoria OR temp.id_temporada=col.id_temporada)', { idProducto })
      .andWhere('p.estado = :estado', { estado: true })
      .andWhere('(p.fecha_inicio IS NULL OR p.fecha_inicio <= :hoy)', { hoy })
      .andWhere('(p.fecha_fin IS NULL OR p.fecha_fin >= :hoy)', { hoy })
      .orderBy('p.porcentaje', 'DESC')
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
    if (dto.idsCategorias) {
      const categorias = await this.categoriaRepo.findBy({ idCategoria: In(dto.idsCategorias) });
      if (categorias.length !== dto.idsCategorias.length) throw new NotFoundException('Algunas categorías no fueron encontradas');
      promo.categorias = categorias;
    }
    if (dto.idsTemporadas) {
      const temporadas = await this.temporadaRepo.findBy({ idTemporada: In(dto.idsTemporadas) });
      if (temporadas.length !== dto.idsTemporadas.length) throw new NotFoundException('Algunas temporadas no fueron encontradas');
      promo.temporadas = temporadas;
    }

    return this.promocionRepo.save(promo);
  }

  async remove(id: number) {
    const promo = await this.findOne(id);
    await this.promocionRepo.remove(promo);
    return { message: `Promoción ${id} eliminada` };
  }
}
