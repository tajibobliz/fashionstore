import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
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
import { ImagenVariante } from './entities/imagen-variante.entity';
import { CreateImagenVarianteDto } from './dto/create-imagen-variante.dto';
import { Inventario } from '../inventory/entities/inventario.entity';
import { Almacen } from '../warehouses/entities/almacen.entity';
import { Sucursal } from '../branches/entities/sucursal.entity';

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
    @InjectRepository(ImagenVariante) private readonly imagenVarianteRepo: Repository<ImagenVariante>,
    @InjectRepository(Inventario) private readonly inventarioRepo: Repository<Inventario>,
    @InjectRepository(Sucursal) private readonly sucursalRepo: Repository<Sucursal>,
  ) {}

  // ===== CATEGORIAS =====
  createCategoria(dto: CreateCategoriaDto, branchId?: number) {
    return this.categoriaRepo.save(this.categoriaRepo.create({ nombre: dto.nombre, descripcion: dto.descripcion, sucursal: branchId ? { idSucursal: branchId } as Sucursal : null }));
  }
  findAllCategorias(branchId?: number) { return branchId ? this.categoriaRepo.createQueryBuilder('c').leftJoinAndSelect('c.sucursal', 's').where('c.id_sucursal IS NULL OR c.id_sucursal=:idSucursal', { idSucursal: branchId }).getMany() : this.categoriaRepo.find(); }
  async findOneCategoria(id: number) {
    const item = await this.categoriaRepo.findOne({ where: { idCategoria: id }, relations: { sucursal: true } });
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
  createTalla(dto: CreateTallaDto, branchId?: number) {
    return this.tallaRepo.save(this.tallaRepo.create({ nombre: dto.nombre, sucursal: branchId ? { idSucursal: branchId } as Sucursal : null }));
  }
  findAllTallas(branchId?: number) { return branchId ? this.tallaRepo.createQueryBuilder('t').leftJoinAndSelect('t.sucursal', 's').where('t.id_sucursal IS NULL OR t.id_sucursal=:idSucursal', { idSucursal: branchId }).getMany() : this.tallaRepo.find(); }
  async findOneTalla(id: number) {
    const item = await this.tallaRepo.findOne({ where: { idTalla: id }, relations: { sucursal: true } });
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
  createColor(dto: CreateColorDto, branchId?: number) {
    return this.colorRepo.save(this.colorRepo.create({ nombre: dto.nombre, codigoHex: dto.codigoHex, sucursal: branchId ? { idSucursal: branchId } as Sucursal : null }));
  }
  findAllColores(branchId?: number) { return branchId ? this.colorRepo.createQueryBuilder('c').leftJoinAndSelect('c.sucursal', 's').where('c.id_sucursal IS NULL OR c.id_sucursal=:idSucursal', { idSucursal: branchId }).getMany() : this.colorRepo.find(); }
  async findOneColor(id: number) {
    const item = await this.colorRepo.findOne({ where: { idColor: id }, relations: { sucursal: true } });
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
  async createProducto(dto: CreateProductoDto, branchId?: number) {
    const categoria = await this.findCategoriaDisponible(dto.idCategoria, branchId);
    const catalogImage = dto.imagenCatalogoUrl ?? dto.imagenUrl ?? null;
    const fittingImage = dto.imagenVestidorUrl || null;
    const producto = this.productoRepo.create({
      nombre: dto.nombre,
      descripcion: dto.descripcion,
      precio: dto.precio,
      precioMayorista: dto.precioMayorista,
      cantidadMinimaMayorista: dto.cantidadMinimaMayorista,
      imagenUrl: catalogImage ?? undefined,
      imagenCatalogoUrl: catalogImage,
      recursoRaUrl: dto.recursoRaUrl,
      imagenTryOn: fittingImage,
      imagenVestidorUrl: fittingImage,
      tipoTryOn: dto.tipoTryOn ?? null,
      tipoPrendaVestidor: dto.tipoPrendaVestidor ?? legacyGarmentType(dto.tipoTryOn),
      sucursalOrigen: branchId ? { idSucursal: branchId } as Sucursal : null,
      estado: dto.estado ?? true,
      categoria,
    });
    if (dto.idProveedor) producto.proveedor = await this.findOneProveedor(dto.idProveedor);
    if (dto.idColeccion) producto.coleccion = await this.findOneColeccion(dto.idColeccion);
    return this.productoRepo.save(producto);
  }
  findAllProductos() { return this.productoRepo.find(); }
  findAllProductosByBranch(idSucursal: number) {
    return this.productoRepo.createQueryBuilder('p')
      .leftJoin('p.variantes', 'v')
      .leftJoin(Inventario, 'i', 'i.id_variante=v.id_variante')
      .leftJoin(Almacen, 'a', 'a.id_almacen=i.id_almacen AND a.id_sucursal=i.id_sucursal')
      .leftJoinAndSelect('p.categoria', 'categoria')
      .leftJoinAndSelect('p.sucursalOrigen', 'sucursalOrigen')
      .leftJoinAndSelect('p.proveedor', 'proveedor')
      .leftJoinAndSelect('p.coleccion', 'coleccion')
      .where('(a.id_sucursal=:idSucursal OR p.id_sucursal_origen=:idSucursal)', { idSucursal })
      .distinct(true)
      .getMany();
  }
  async findOneProducto(id: number) {
  const item = await this.productoRepo.findOne({
    where: { idProducto: id },
    relations: {
      variantes: {
        talla: true,
        color: true,
      },
      sucursalOrigen: true,
    },
  });
  if (!item) throw new NotFoundException(`Producto ${id} no encontrado`);
  return item;
}
  async findOneProductoByBranch(id: number, idSucursal: number) {
    const item = await this.findOneProducto(id);
    if (item.sucursalOrigen?.idSucursal === idSucursal) return item;
    const rows = await this.varianteRepo.createQueryBuilder('v')
      .innerJoin(Inventario, 'i', 'i.id_variante=v.id_variante')
      .innerJoin(Almacen, 'a', 'a.id_almacen=i.id_almacen AND a.id_sucursal=i.id_sucursal')
      .select('v.id_variante', 'idVariante')
      .where('v.id_producto=:idProducto', { idProducto: id })
      .andWhere('a.id_sucursal=:idSucursal', { idSucursal })
      .getRawMany<{ idVariante: number }>();
    const allowedIds = new Set(rows.map((row) => Number(row.idVariante)));
    item.variantes = (item.variantes ?? []).filter((variant) => allowedIds.has(variant.idVariante));
    if (!item.variantes.length) throw new NotFoundException(`Producto ${id} no disponible en esta sucursal`);
    return item;
  }

  private async findCategoriaDisponible(id: number, branchId?: number) {
    const item = await this.findOneCategoria(id);
    if (branchId && item.sucursal && item.sucursal.idSucursal !== branchId) throw new NotFoundException(`Categoría ${id} no disponible en esta sucursal`);
    return item;
  }

  private async findTallaDisponible(id: number, branchId?: number) {
    const item = await this.findOneTalla(id);
    if (branchId && item.sucursal && item.sucursal.idSucursal !== branchId) throw new NotFoundException(`Talla ${id} no disponible en esta sucursal`);
    return item;
  }

  private async findColorDisponible(id: number, branchId?: number) {
    const item = await this.findOneColor(id);
    if (branchId && item.sucursal && item.sucursal.idSucursal !== branchId) throw new NotFoundException(`Color ${id} no disponible en esta sucursal`);
    return item;
  }

  async updateProducto(id: number, dto: UpdateProductoDto, branchId?: number) {
    const item = branchId
      ? await this.findOneProductoByBranch(id, branchId)
      : await this.findOneProducto(id);
    if (dto.idCategoria) item.categoria = await this.findCategoriaDisponible(dto.idCategoria, branchId);
    if (dto.idProveedor) item.proveedor = await this.findOneProveedor(dto.idProveedor);
    if (dto.idColeccion) item.coleccion = await this.findOneColeccion(dto.idColeccion);
    const catalogImage = dto.imagenCatalogoUrl ?? dto.imagenUrl;
    const fittingImage = dto.imagenVestidorUrl;
    Object.assign(item, {
      nombre: dto.nombre ?? item.nombre,
      descripcion: dto.descripcion ?? item.descripcion,
      precio: dto.precio ?? item.precio,
      precioMayorista: dto.precioMayorista ?? item.precioMayorista,
      cantidadMinimaMayorista: dto.cantidadMinimaMayorista ?? item.cantidadMinimaMayorista,
      imagenUrl: catalogImage === undefined ? item.imagenUrl : catalogImage || null,
      imagenCatalogoUrl: catalogImage === undefined ? item.imagenCatalogoUrl ?? item.imagenUrl : catalogImage || null,
      recursoRaUrl: dto.recursoRaUrl ?? item.recursoRaUrl,
      // undefined conserva el valor actual; null o '' lo elimina
      imagenTryOn: fittingImage === undefined ? item.imagenTryOn : fittingImage || null,
      imagenVestidorUrl: fittingImage === undefined ? item.imagenVestidorUrl : fittingImage || null,
      // undefined conserva el tipo actual; null explícito lo limpia (el admin lo envía así al elegir "Sin vestidor")
      tipoTryOn: dto.tipoTryOn === undefined ? item.tipoTryOn : dto.tipoTryOn,
      tipoPrendaVestidor: dto.tipoPrendaVestidor === undefined ? (dto.tipoTryOn === undefined ? item.tipoPrendaVestidor : legacyGarmentType(dto.tipoTryOn)) : dto.tipoPrendaVestidor,
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
  async createVariante(dto: CreateVarianteDto, branchId?: number) {
    const producto = await this.findOneProducto(dto.idProducto);
    if (branchId && producto.sucursalOrigen?.idSucursal !== branchId) {
      const hasBranchInventory = await this.varianteRepo.createQueryBuilder('v')
        .innerJoin(Inventario, 'i', 'i.id_variante=v.id_variante')
        .innerJoin(Almacen, 'a', 'a.id_almacen=i.id_almacen AND a.id_sucursal=i.id_sucursal')
        .where('v.id_producto=:idProducto', { idProducto: dto.idProducto })
        .andWhere('a.id_sucursal=:idSucursal', { idSucursal: branchId })
        .getCount();
      if (!hasBranchInventory) throw new NotFoundException(`Producto ${dto.idProducto} no está disponible en esta sucursal`);
    }
    const sku = dto.sku.trim();
    const talla = dto.idTalla ? await this.findTallaDisponible(dto.idTalla, branchId) : null;
    const color = dto.idColor ? await this.findColorDisponible(dto.idColor, branchId) : null;
    const duplicateSku = await this.varianteRepo.findOne({ where: { sku } });
    if (duplicateSku) {
      const sameVariant = duplicateSku.producto.idProducto === dto.idProducto
        && (duplicateSku.talla?.idTalla ?? null) === (dto.idTalla ?? null)
        && (duplicateSku.color?.idColor ?? null) === (dto.idColor ?? null);
      if (!sameVariant) throw new ConflictException(`Ya existe otra variante con el SKU "${sku}"`);
      if (branchId) await this.ensureVariantBranchInventory(duplicateSku, branchId);
      return duplicateSku;
    }

    const duplicateCombinationQuery = this.varianteRepo.createQueryBuilder('v')
      .where('v.id_producto=:idProducto', { idProducto: dto.idProducto });
    if (dto.idTalla) duplicateCombinationQuery.andWhere('v.id_talla=:idTalla', { idTalla: dto.idTalla });
    else duplicateCombinationQuery.andWhere('v.id_talla IS NULL');
    if (dto.idColor) duplicateCombinationQuery.andWhere('v.id_color=:idColor', { idColor: dto.idColor });
    else duplicateCombinationQuery.andWhere('v.id_color IS NULL');
    if (await duplicateCombinationQuery.getOne()) {
      throw new ConflictException('Ya existe una variante de este producto con la misma talla y color');
    }

    const variante = this.varianteRepo.create({
      sku,
      producto,
      imagenVestidorUrl: dto.imagenVestidorUrl || null,
      talla: talla ?? undefined,
      color: color ?? undefined,
    });
    try {
      const saved = await this.varianteRepo.save(variante);
      if (branchId) await this.ensureVariantBranchInventory(saved, branchId);
      return saved;
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string }).code === '23505') {
        throw new ConflictException('El SKU o la combinación de talla y color ya pertenece a otra variante');
      }
      throw error;
    }
  }

  private async ensureVariantBranchInventory(variante: VarianteProducto, branchId: number) {
    const existing = await this.inventarioRepo.findOne({
      where: { sucursal: { idSucursal: branchId }, variante: { idVariante: variante.idVariante } },
    });
    if (existing) return existing;

    const warehouseRepo = this.inventarioRepo.manager.getRepository(Almacen);
    const almacen = await warehouseRepo.findOne({
      where: { sucursal: { idSucursal: branchId }, codigo: 'PRINCIPAL', estado: true },
    }) ?? await warehouseRepo.findOne({
      where: { sucursal: { idSucursal: branchId }, estado: true },
      order: { idAlmacen: 'ASC' },
    });
    if (!almacen) throw new BadRequestException('La sucursal no tiene un almacén activo para registrar la variante');

    const sucursal = await this.sucursalRepo.findOne({ where: { idSucursal: branchId } });
    if (!sucursal) throw new NotFoundException(`Sucursal ${branchId} no encontrada`);
    return this.inventarioRepo.save(this.inventarioRepo.create({
      sucursal,
      almacen,
      variante,
      stockDisponible: 0,
      stockReservado: 0,
    }));
  }
  findAllVariantes() { return this.varianteRepo.find(); }
  findAllVariantesByBranch(idSucursal: number) {
    return this.varianteRepo.createQueryBuilder('v')
      .leftJoin(Inventario, 'i', 'i.id_variante=v.id_variante')
      .leftJoin(Almacen, 'a', 'a.id_almacen=i.id_almacen AND a.id_sucursal=i.id_sucursal')
      .leftJoinAndSelect('v.producto', 'producto')
      .leftJoinAndSelect('producto.sucursalOrigen', 'sucursalOrigen')
      .leftJoinAndSelect('producto.categoria', 'categoria')
      .leftJoinAndSelect('v.talla', 'talla')
      .leftJoinAndSelect('v.color', 'color')
      .leftJoinAndSelect('v.imagenes', 'imagenes')
      .where('(a.id_sucursal=:idSucursal OR producto.id_sucursal_origen=:idSucursal)', { idSucursal })
      .distinct(true)
      .getMany();
  }
  async findOneVariante(id: number) {
    const item = await this.varianteRepo.findOne({ where: { idVariante: id }, relations: { producto: { sucursalOrigen: true }, talla: true, color: true, imagenes: true } });
    if (!item) throw new NotFoundException(`Variante ${id} no encontrada`);
    return item;
  }
  async findOneVarianteByBranch(id: number, idSucursal: number) {
    const item = await this.varianteRepo.findOne({ where: { idVariante: id }, relations: { producto: { sucursalOrigen: true }, talla: true, color: true, imagenes: true } });
    if (!item) throw new NotFoundException(`Variante ${id} no encontrada`);
    if (item.producto?.sucursalOrigen?.idSucursal === idSucursal) return item;
    const count = await this.inventarioRepo.createQueryBuilder('i')
      .innerJoin(Almacen, 'a', 'a.id_almacen=i.id_almacen AND a.id_sucursal=i.id_sucursal')
      .where('i.id_variante=:idVariante', { idVariante: id })
      .andWhere('a.id_sucursal=:idSucursal', { idSucursal })
      .getCount();
    if (!count) throw new NotFoundException(`Variante ${id} no disponible en esta sucursal`);
    return item;
  }
  async updateVariante(id: number, dto: UpdateVarianteDto, branchId?: number) {
    const item = branchId
      ? await this.findOneVarianteByBranch(id, branchId)
      : await this.findOneVariante(id);
    if (dto.idProducto) {
      const nextProduct = await this.findOneProducto(dto.idProducto);
      if (branchId && nextProduct.sucursalOrigen?.idSucursal !== branchId) throw new NotFoundException(`Producto ${dto.idProducto} no pertenece a esta sucursal`);
      item.producto = nextProduct;
    }
    if (dto.idTalla) item.talla = await this.findTallaDisponible(dto.idTalla, branchId);
    if (dto.idColor) item.color = await this.findColorDisponible(dto.idColor, branchId);
    if (dto.sku) item.sku = dto.sku;
    if (dto.imagenVestidorUrl !== undefined) item.imagenVestidorUrl = dto.imagenVestidorUrl || null;
    return this.varianteRepo.save(item);
  }
  async removeVariante(id: number) {
    const item = await this.findOneVariante(id);
    await this.varianteRepo.remove(item);
    return { message: `Variante ${id} eliminada` };
  }

  async findImagenesVariante(idVariante: number) {
    await this.findOneVariante(idVariante);
    return this.imagenVarianteRepo.find({
      where: { variante: { idVariante } },
      order: { orden: 'ASC' },
    });
  }

  async findImagenesVarianteByBranch(idVariante: number, idSucursal: number) {
    await this.findOneVarianteByBranch(idVariante, idSucursal);
    return this.findImagenesVariante(idVariante);
  }

  async createImagenVariante(idVariante: number, dto: CreateImagenVarianteDto) {
    const variante = await this.findOneVariante(idVariante);
    const imagenes = await this.findImagenesVariante(idVariante);
    if (imagenes.length >= 3) throw new BadRequestException('Una variante admite como máximo 3 imágenes');

    const orden = dto.orden ?? [1, 2, 3].find((value) => !imagenes.some((imagen) => imagen.orden === value));
    if (!orden || imagenes.some((imagen) => imagen.orden === orden)) {
      throw new BadRequestException('El orden de imagen debe ser único y estar entre 1 y 3');
    }

    if (dto.principal || imagenes.length === 0) {
      await this.imagenVarianteRepo.update({ variante: { idVariante } }, { principal: false });
    }
    return this.imagenVarianteRepo.save(this.imagenVarianteRepo.create({
      variante,
      url: dto.url,
      orden,
      principal: dto.principal || imagenes.length === 0,
    }));
  }

  async setImagenPrincipal(idVariante: number, idImagen: number) {
    const imagen = await this.imagenVarianteRepo.findOne({ where: { idImagen, variante: { idVariante } } });
    if (!imagen) throw new NotFoundException(`Imagen ${idImagen} no encontrada en la variante`);
    await this.imagenVarianteRepo.update({ variante: { idVariante } }, { principal: false });
    imagen.principal = true;
    return this.imagenVarianteRepo.save(imagen);
  }

  async removeImagenVariante(idVariante: number, idImagen: number) {
    const imagen = await this.imagenVarianteRepo.findOne({ where: { idImagen, variante: { idVariante } } });
    if (!imagen) throw new NotFoundException(`Imagen ${idImagen} no encontrada en la variante`);
    await this.imagenVarianteRepo.remove(imagen);
    const remaining = await this.findImagenesVariante(idVariante);
    if (imagen.principal && remaining.length) {
      remaining[0].principal = true;
      await this.imagenVarianteRepo.save(remaining[0]);
    }
    return { message: 'Imagen eliminada' };
  }
}

function legacyGarmentType(value?: string | null): Producto['tipoPrendaVestidor'] {
  if (value === 'gorra') return 'GORRA';
  if (value === 'polera') return 'TOP';
  return null;
}
