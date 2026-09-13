import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Categoria } from './entities/categoria.entity';
import { Talla } from './entities/talla.entity';
import { Color } from './entities/color.entity';
import { Temporada } from './entities/temporada.entity';
import { Proveedor } from './entities/proveedor.entity';
import { Coleccion } from './entities/coleccion.entity';
import { Producto } from './entities/producto.entity';
import { VarianteProducto } from './entities/variante-producto.entity';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';
import { CreateTallaDto } from './dto/create-talla.dto';
import { UpdateTallaDto } from './dto/update-talla.dto';
import { CreateColorDto } from './dto/create-color.dto';
import { UpdateColorDto } from './dto/update-color.dto';
import { CreateTemporadaDto } from './dto/create-temporada.dto';
import { UpdateTemporadaDto } from './dto/update-temporada.dto';
import { CreateProveedorDto } from './dto/create-proveedor.dto';
import { UpdateProveedorDto } from './dto/update-proveedor.dto';
import { CreateColeccionDto } from './dto/create-coleccion.dto';
import { UpdateColeccionDto } from './dto/update-coleccion.dto';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';
import { CreateVarianteDto } from './dto/create-variante.dto';
import { UpdateVarianteDto } from './dto/update-variante.dto';

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Categoria) private readonly categoriaRepo: Repository<Categoria>,
    @InjectRepository(Talla) private readonly tallaRepo: Repository<Talla>,
    @InjectRepository(Color) private readonly colorRepo: Repository<Color>,
    @InjectRepository(Temporada) private readonly temporadaRepo: Repository<Temporada>,
    @InjectRepository(Proveedor) private readonly proveedorRepo: Repository<Proveedor>,
    @InjectRepository(Coleccion) private readonly coleccionRepo: Repository<Coleccion>,
    @InjectRepository(Producto) private readonly productoRepo: Repository<Producto>,
    @InjectRepository(VarianteProducto) private readonly varianteRepo: Repository<VarianteProducto>,
  ) {}

  // ===== CATEGORIAS =====
  createCategoria(dto: CreateCategoriaDto) {
    return this.categoriaRepo.save(this.categoriaRepo.create(dto));
  }
  findAllCategorias() { return this.categoriaRepo.find(); }
  async findOneCategoria(id: number) {
    const item = await this.categoriaRepo.findOne({ where: { idCategoria: id } });
    if (!item) throw new NotFoundException(`Categoría ${id} no encontrada`);
    return item;
  }
  async updateCategoria(id: number, dto: UpdateCategoriaDto) {
    const item = await this.findOneCategoria(id);
    Object.assign(item, dto);
    return this.categoriaRepo.save(item);
  }
  async removeCategoria(id: number) {
    const item = await this.findOneCategoria(id);
    await this.categoriaRepo.remove(item);
    return { message: `Categoría ${id} eliminada` };
  }

  // ===== TALLAS =====
  createTalla(dto: CreateTallaDto) {
    return this.tallaRepo.save(this.tallaRepo.create(dto));
  }
  findAllTallas() { return this.tallaRepo.find(); }
  async findOneTalla(id: number) {
    const item = await this.tallaRepo.findOne({ where: { idTalla: id } });
    if (!item) throw new NotFoundException(`Talla ${id} no encontrada`);
    return item;
  }
  async updateTalla(id: number, dto: UpdateTallaDto) {
    const item = await this.findOneTalla(id);
    Object.assign(item, dto);
    return this.tallaRepo.save(item);
  }
  async removeTalla(id: number) {
    const item = await this.findOneTalla(id);
    await this.tallaRepo.remove(item);
    return { message: `Talla ${id} eliminada` };
  }

  // ===== COLORES =====
  createColor(dto: CreateColorDto) {
    return this.colorRepo.save(this.colorRepo.create(dto));
  }
  findAllColores() { return this.colorRepo.find(); }
  async findOneColor(id: number) {
    const item = await this.colorRepo.findOne({ where: { idColor: id } });
    if (!item) throw new NotFoundException(`Color ${id} no encontrado`);
    return item;
  }
  async updateColor(id: number, dto: UpdateColorDto) {
    const item = await this.findOneColor(id);
    Object.assign(item, dto);
    return this.colorRepo.save(item);
  }
  async removeColor(id: number) {
    const item = await this.findOneColor(id);
    await this.colorRepo.remove(item);
    return { message: `Color ${id} eliminado` };
  }

  // ===== TEMPORADAS =====
  createTemporada(dto: CreateTemporadaDto) {
    return this.temporadaRepo.save(this.temporadaRepo.create(dto as any));
  }
  findAllTemporadas() { return this.temporadaRepo.find(); }
  async findOneTemporada(id: number) {
    const item = await this.temporadaRepo.findOne({ where: { idTemporada: id } });
    if (!item) throw new NotFoundException(`Temporada ${id} no encontrada`);
    return item;
  }
  async updateTemporada(id: number, dto: UpdateTemporadaDto) {
    const item = await this.findOneTemporada(id);
    Object.assign(item, dto);
    return this.temporadaRepo.save(item);
  }
  async removeTemporada(id: number) {
    const item = await this.findOneTemporada(id);
    await this.temporadaRepo.remove(item);
    return { message: `Temporada ${id} eliminada` };
  }

  // ===== PROVEEDORES =====
  createProveedor(dto: CreateProveedorDto) {
    return this.proveedorRepo.save(this.proveedorRepo.create(dto));
  }
  findAllProveedores() { return this.proveedorRepo.find(); }
  async findOneProveedor(id: number) {
    const item = await this.proveedorRepo.findOne({ where: { idProveedor: id } });
    if (!item) throw new NotFoundException(`Proveedor ${id} no encontrado`);
    return item;
  }
  async updateProveedor(id: number, dto: UpdateProveedorDto) {
    const item = await this.findOneProveedor(id);
    Object.assign(item, dto);
    return this.proveedorRepo.save(item);
  }
  async removeProveedor(id: number) {
    const item = await this.findOneProveedor(id);
    await this.proveedorRepo.remove(item);
    return { message: `Proveedor ${id} eliminado` };
  }

  // ===== COLECCIONES =====
  async createColeccion(dto: CreateColeccionDto) {
    const coleccion = this.coleccionRepo.create({ nombre: dto.nombre });
    if (dto.idTemporada) {
      coleccion.temporada = await this.findOneTemporada(dto.idTemporada);
    }
    return this.coleccionRepo.save(coleccion);
  }
  findAllColecciones() { return this.coleccionRepo.find(); }
  async findOneColeccion(id: number) {
    const item = await this.coleccionRepo.findOne({ where: { idColeccion: id } });
    if (!item) throw new NotFoundException(`Colección ${id} no encontrada`);
    return item;
  }
  async updateColeccion(id: number, dto: UpdateColeccionDto) {
    const item = await this.findOneColeccion(id);
    if (dto.nombre) item.nombre = dto.nombre;
    if (dto.idTemporada) item.temporada = await this.findOneTemporada(dto.idTemporada);
    return this.coleccionRepo.save(item);
  }
  async removeColeccion(id: number) {
    const item = await this.findOneColeccion(id);
    await this.coleccionRepo.remove(item);
    return { message: `Colección ${id} eliminada` };
  }

  // ===== PRODUCTOS =====
  async createProducto(dto: CreateProductoDto) {
    const producto = this.productoRepo.create({
      nombre: dto.nombre,
      descripcion: dto.descripcion,
      precio: dto.precio,
      imagenUrl: dto.imagenUrl,
      recursoRaUrl: dto.recursoRaUrl,
      estado: dto.estado ?? true,
      categoria: await this.findOneCategoria(dto.idCategoria),
    });
    if (dto.idProveedor) producto.proveedor = await this.findOneProveedor(dto.idProveedor);
    if (dto.idColeccion) producto.coleccion = await this.findOneColeccion(dto.idColeccion);
    return this.productoRepo.save(producto);
  }
  findAllProductos() { return this.productoRepo.find(); }
  async findOneProducto(id: number) {
    const item = await this.productoRepo.findOne({ where: { idProducto: id } });
    if (!item) throw new NotFoundException(`Producto ${id} no encontrado`);
    return item;
  }
  async updateProducto(id: number, dto: UpdateProductoDto) {
    const item = await this.findOneProducto(id);
    if (dto.idCategoria) item.categoria = await this.findOneCategoria(dto.idCategoria);
    if (dto.idProveedor) item.proveedor = await this.findOneProveedor(dto.idProveedor);
    if (dto.idColeccion) item.coleccion = await this.findOneColeccion(dto.idColeccion);
    Object.assign(item, {
      nombre: dto.nombre ?? item.nombre,
      descripcion: dto.descripcion ?? item.descripcion,
      precio: dto.precio ?? item.precio,
      imagenUrl: dto.imagenUrl ?? item.imagenUrl,
      recursoRaUrl: dto.recursoRaUrl ?? item.recursoRaUrl,
      estado: dto.estado ?? item.estado,
    });
    return this.productoRepo.save(item);
  }
  async removeProducto(id: number) {
    const item = await this.findOneProducto(id);
    await this.productoRepo.remove(item);
    return { message: `Producto ${id} eliminado` };
  }

  // ===== VARIANTES =====
  async createVariante(dto: CreateVarianteDto) {
    const variante = this.varianteRepo.create({
      sku: dto.sku,
      producto: await this.findOneProducto(dto.idProducto),
    });
    if (dto.idTalla) variante.talla = await this.findOneTalla(dto.idTalla);
    if (dto.idColor) variante.color = await this.findOneColor(dto.idColor);
    return this.varianteRepo.save(variante);
  }
  findAllVariantes() { return this.varianteRepo.find(); }
  async findOneVariante(id: number) {
    const item = await this.varianteRepo.findOne({ where: { idVariante: id } });
    if (!item) throw new NotFoundException(`Variante ${id} no encontrada`);
    return item;
  }
  async updateVariante(id: number, dto: UpdateVarianteDto) {
    const item = await this.findOneVariante(id);
    if (dto.idProducto) item.producto = await this.findOneProducto(dto.idProducto);
    if (dto.idTalla) item.talla = await this.findOneTalla(dto.idTalla);
    if (dto.idColor) item.color = await this.findOneColor(dto.idColor);
    if (dto.sku) item.sku = dto.sku;
    return this.varianteRepo.save(item);
  }
  async removeVariante(id: number) {
    const item = await this.findOneVariante(id);
    await this.varianteRepo.remove(item);
    return { message: `Variante ${id} eliminada` };
  }
}