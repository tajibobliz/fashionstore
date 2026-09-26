import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Categoria } from '../entities/categoria.entity';
import { Talla } from '../entities/talla.entity';
import { Color } from '../entities/color.entity';
import { Producto } from '../entities/producto.entity';
import { VarianteProducto } from '../entities/variante-producto.entity';
import { Sucursal } from '../../branches/entities/sucursal.entity';
import { Almacen } from '../../warehouses/entities/almacen.entity';
import { Inventario } from '../../inventory/entities/inventario.entity';

interface ProductSeedItem {
  nombre: string;
  categoria: string;
  precio: number;
  descripcion: string;
  imagenUrl: string;
  tallas: string[];
  colores: string[];
}

// Catálogo de moda femenina, con precios expresados en bolivianos (Bs).
const PRODUCTS_SEED_DATA: ProductSeedItem[] = [
  { nombre: 'Zapato tacón bajo', categoria: 'Calzado femenino', precio: 350.0, descripcion: 'Zapato de tacón bajo elegante para el día a día.', imagenUrl: "https://cdn.dummyjson.com/product-images/womens-shoes/black-&-brown-slipper/thumbnail.webp", tallas: ['36', '37', '38', '39', '40'], colores: ['Negro', 'Beige'] },
  { nombre: 'Bota corta café', categoria: 'Calzado femenino', precio: 420.0, descripcion: 'Bota corta de cuero café, perfecta para otoño.', imagenUrl: "https://cdn.dummyjson.com/product-images/womens-shoes/calvin-klein-heel-shoes/thumbnail.webp", tallas: ['36', '37', '38', '39', '40'], colores: ['Café'] },
  { nombre: 'Tenis blanco urbano', categoria: 'Calzado femenino', precio: 380.0, descripcion: 'Tenis blanco casual para el día a día.', imagenUrl: "https://cdn.dummyjson.com/product-images/womens-shoes/golden-shoes-woman/thumbnail.webp", tallas: ['36', '37', '38', '39', '40'], colores: ['Blanco'] },
  { nombre: 'Sandalia verano', categoria: 'Calzado femenino', precio: 280.0, descripcion: 'Sandalia ligera ideal para clima cálido.', imagenUrl: "https://cdn.dummyjson.com/product-images/womens-shoes/pampi-shoes/thumbnail.webp", tallas: ['36', '37', '38', '39', '40'], colores: ['Beige', 'Negro'] },
  { nombre: 'Botín taco alto', categoria: 'Calzado femenino', precio: 490.0, descripcion: 'Botín de taco alto para looks nocturnos.', imagenUrl: "https://cdn.dummyjson.com/product-images/womens-shoes/red-shoes/thumbnail.webp", tallas: ['36', '37', '38', '39', '40'], colores: ['Negro', 'Rojo'] },

  { nombre: 'Vestido floral primavera', categoria: 'Vestidos', precio: 320.0, descripcion: 'Vestido casual con estampado floral, ligero y cómodo.', imagenUrl: "https://cdn.dummyjson.com/product-images/womens-dresses/black-women's-gown/thumbnail.webp", tallas: ['XS', 'S', 'M', 'L', 'XL'], colores: ['Rosado', 'Azul'] },
  { nombre: 'Vestido negro elegante', categoria: 'Vestidos', precio: 450.0, descripcion: 'Vestido negro clásico para ocasiones formales.', imagenUrl: 'https://cdn.dummyjson.com/product-images/womens-dresses/corset-leather-with-skirt/thumbnail.webp', tallas: ['XS', 'S', 'M', 'L', 'XL'], colores: ['Negro'] },
  { nombre: 'Vestido casual verano', categoria: 'Vestidos', precio: 260.0, descripcion: 'Vestido de verano fresco y colorido.', imagenUrl: 'https://cdn.dummyjson.com/product-images/womens-dresses/corset-with-black-skirt/thumbnail.webp', tallas: ['XS', 'S', 'M', 'L', 'XL'], colores: ['Blanco', 'Amarillo'] },
  { nombre: 'Vestido cóctel rojo', categoria: 'Vestidos', precio: 520.0, descripcion: 'Vestido cóctel llamativo para eventos.', imagenUrl: 'https://cdn.dummyjson.com/product-images/womens-dresses/dress-pea/thumbnail.webp', tallas: ['XS', 'S', 'M', 'L'], colores: ['Rojo'] },
  { nombre: 'Vestido maxi playero', categoria: 'Vestidos', precio: 290.0, descripcion: 'Vestido largo ideal para la playa.', imagenUrl: "https://cdn.dummyjson.com/product-images/womens-dresses/marni-red-&-black-suit/thumbnail.webp", tallas: ['S', 'M', 'L', 'XL'], colores: ['Azul', 'Blanco'] },

  { nombre: 'Blusa manga corta blanca', categoria: 'Blusas', precio: 150.0, descripcion: 'Blusa clásica de manga corta, básico esencial.', imagenUrl: 'https://cdn.dummyjson.com/product-images/tops/blue-frock/thumbnail.webp', tallas: ['XS', 'S', 'M', 'L', 'XL'], colores: ['Blanco', 'Negro'] },
  { nombre: 'Blusa negra manga larga', categoria: 'Blusas', precio: 180.0, descripcion: 'Blusa negra de manga larga versátil.', imagenUrl: 'https://cdn.dummyjson.com/product-images/tops/girl-summer-dress/thumbnail.webp', tallas: ['XS', 'S', 'M', 'L', 'XL'], colores: ['Negro'] },
  { nombre: 'Blusa estampada', categoria: 'Blusas', precio: 210.0, descripcion: 'Blusa con estampado moderno para looks casuales.', imagenUrl: 'https://cdn.dummyjson.com/product-images/tops/gray-dress/thumbnail.webp', tallas: ['XS', 'S', 'M', 'L'], colores: ['Azul', 'Rojo', 'Verde'] },
  { nombre: 'Camisa blanca oficina', categoria: 'Blusas', precio: 240.0, descripcion: 'Camisa formal ideal para trabajo.', imagenUrl: 'https://cdn.dummyjson.com/product-images/tops/short-frock/thumbnail.webp', tallas: ['S', 'M', 'L', 'XL'], colores: ['Blanco'] },

  { nombre: 'Jean skinny', categoria: 'Pantalones', precio: 250.0, descripcion: 'Jean skinny de tiro alto, ajuste perfecto.', imagenUrl: 'https://picsum.photos/seed/jean-skinny/800/800', tallas: ['XS', 'S', 'M', 'L', 'XL'], colores: ['Azul', 'Negro'] },
  { nombre: 'Pantalón palazzo', categoria: 'Pantalones', precio: 220.0, descripcion: 'Pantalón amplio y cómodo estilo palazzo.', imagenUrl: 'https://picsum.photos/seed/palazzo/800/800', tallas: ['S', 'M', 'L', 'XL'], colores: ['Negro', 'Beige'] },
  { nombre: 'Leggings deportivos', categoria: 'Pantalones', precio: 170.0, descripcion: 'Leggings elásticos para deporte o casual.', imagenUrl: 'https://picsum.photos/seed/leggings/800/800', tallas: ['XS', 'S', 'M', 'L', 'XL'], colores: ['Negro', 'Gris'] },

  { nombre: 'Falda plisada', categoria: 'Faldas', precio: 180.0, descripcion: 'Falda plisada versátil, ideal para look formal o casual.', imagenUrl: 'https://picsum.photos/seed/falda-plisada/800/800', tallas: ['XS', 'S', 'M', 'L'], colores: ['Negro', 'Beige', 'Rojo'] },
  { nombre: 'Falda midi denim', categoria: 'Faldas', precio: 210.0, descripcion: 'Falda midi de mezclilla, básico atemporal.', imagenUrl: 'https://picsum.photos/seed/falda-midi/800/800', tallas: ['XS', 'S', 'M', 'L'], colores: ['Azul'] },

  { nombre: 'Polerón oversize gris', categoria: 'Poleras y polerones', precio: 220.0, descripcion: 'Polerón oversize cómodo para estilo casual.', imagenUrl: 'https://picsum.photos/seed/poleron-gris/800/800', tallas: ['S', 'M', 'L', 'XL'], colores: ['Gris', 'Rosado', 'Negro'] },
  { nombre: 'Polerón con capucha', categoria: 'Poleras y polerones', precio: 250.0, descripcion: 'Polerón con capucha, ideal para clima frío.', imagenUrl: 'https://picsum.photos/seed/hoodie/800/800', tallas: ['S', 'M', 'L', 'XL'], colores: ['Negro', 'Azul', 'Blanco'] },
  { nombre: 'Polera básica blanca', categoria: 'Poleras y polerones', precio: 120.0, descripcion: 'Polera básica de algodón, esencial de guardarropa.', imagenUrl: 'https://picsum.photos/seed/polera-basica/800/800', tallas: ['XS', 'S', 'M', 'L', 'XL'], colores: ['Blanco', 'Negro', 'Gris'] },

  { nombre: 'Sombrero fedora', categoria: 'Accesorios', precio: 120.0, descripcion: 'Sombrero fedora clásico, complemento perfecto.', imagenUrl: 'https://picsum.photos/seed/sombrero-fedora/800/800', tallas: ['UNICA'], colores: ['Negro', 'Beige', 'Café'] },
  { nombre: 'Cartera de mano', categoria: 'Accesorios', precio: 320.0, descripcion: 'Cartera de mano elegante, capacidad ideal para el día.', imagenUrl: "https://cdn.dummyjson.com/product-images/womens-bags/blue-women's-handbag/thumbnail.webp", tallas: ['UNICA'], colores: ['Negro', 'Beige', 'Rojo'] },
  { nombre: 'Bufanda tejida', categoria: 'Accesorios', precio: 90.0, descripcion: 'Bufanda tejida a mano, cálida y suave.', imagenUrl: 'https://picsum.photos/seed/bufanda/800/800', tallas: ['UNICA'], colores: ['Rosado', 'Beige', 'Gris'] },
  { nombre: 'Top satinado de tirantes', categoria: 'Blusas', precio: 165, descripcion: 'Top femenino satinado, ideal para combinar de día o de noche.', imagenUrl: 'https://picsum.photos/seed/top-satinado/800/800', tallas: ['XS', 'S', 'M', 'L'], colores: ['Negro', 'Rosado', 'Beige'] },
  { nombre: 'Blusa campesina bordada', categoria: 'Blusas', precio: 195, descripcion: 'Blusa ligera con bordado floral y mangas románticas.', imagenUrl: 'https://picsum.photos/seed/blusa-campesina/800/800', tallas: ['S', 'M', 'L', 'XL'], colores: ['Blanco', 'Rojo'] },
  { nombre: 'Blusa cruzada estampada', categoria: 'Blusas', precio: 185, descripcion: 'Blusa cruzada con estampado femenino para un look casual.', imagenUrl: 'https://picsum.photos/seed/blusa-cruzada/800/800', tallas: ['XS', 'S', 'M', 'L'], colores: ['Azul', 'Rosado'] },
  { nombre: 'Vestido camisero midi', categoria: 'Vestidos', precio: 340, descripcion: 'Vestido camisero midi con cinturón, cómodo para oficina y fin de semana.', imagenUrl: 'https://picsum.photos/seed/vestido-camisero/800/800', tallas: ['S', 'M', 'L', 'XL'], colores: ['Beige', 'Azul'] },
  { nombre: 'Vestido envolvente estampado', categoria: 'Vestidos', precio: 375, descripcion: 'Vestido envolvente con caída fluida y estampado de flores pequeñas.', imagenUrl: 'https://picsum.photos/seed/vestido-envolvente/800/800', tallas: ['XS', 'S', 'M', 'L'], colores: ['Rosado', 'Verde'] },
  { nombre: 'Vestido tejido canalé', categoria: 'Vestidos', precio: 310, descripcion: 'Vestido femenino de punto canalé, suave y versátil.', imagenUrl: 'https://picsum.photos/seed/vestido-canale/800/800', tallas: ['S', 'M', 'L'], colores: ['Negro', 'Beige'] },
  { nombre: 'Pantalón sastre recto', categoria: 'Pantalones', precio: 295, descripcion: 'Pantalón de vestir de corte recto para oficina y ocasiones formales.', imagenUrl: 'https://picsum.photos/seed/pantalon-sastre/800/800', tallas: ['XS', 'S', 'M', 'L', 'XL'], colores: ['Negro', 'Beige'] },
  { nombre: 'Jean mom tiro alto', categoria: 'Pantalones', precio: 280, descripcion: 'Jean femenino de tiro alto y pierna relajada en denim resistente.', imagenUrl: 'https://picsum.photos/seed/jean-mom/800/800', tallas: ['XS', 'S', 'M', 'L', 'XL'], colores: ['Azul', 'Negro'] },
  { nombre: 'Short de lino cintura alta', categoria: 'Pantalones', precio: 190, descripcion: 'Short ligero de lino con cintura alta para días cálidos.', imagenUrl: 'https://picsum.photos/seed/short-lino/800/800', tallas: ['XS', 'S', 'M', 'L'], colores: ['Blanco', 'Beige'] },
  { nombre: 'Falda midi satinada', categoria: 'Faldas', precio: 230, descripcion: 'Falda midi satinada de movimiento fluido.', imagenUrl: 'https://picsum.photos/seed/falda-satinada/800/800', tallas: ['XS', 'S', 'M', 'L'], colores: ['Negro', 'Rosado'] },
  { nombre: 'Falda denim botones', categoria: 'Faldas', precio: 215, descripcion: 'Falda de mezclilla con botones frontales y bolsillos funcionales.', imagenUrl: 'https://picsum.photos/seed/falda-botones/800/800', tallas: ['XS', 'S', 'M', 'L'], colores: ['Azul'] },
  { nombre: 'Falda pantalón plisada', categoria: 'Faldas', precio: 205, descripcion: 'Falda pantalón plisada que combina comodidad y movimiento.', imagenUrl: 'https://picsum.photos/seed/falda-pantalon/800/800', tallas: ['S', 'M', 'L', 'XL'], colores: ['Negro', 'Beige'] },
  { nombre: 'Cardigan tejido ligero', categoria: 'Poleras y polerones', precio: 260, descripcion: 'Cardigan femenino de tejido ligero para media estación.', imagenUrl: 'https://picsum.photos/seed/cardigan/800/800', tallas: ['S', 'M', 'L', 'XL'], colores: ['Beige', 'Rosado'] },
  { nombre: 'Polera cuello cuadrado', categoria: 'Poleras y polerones', precio: 135, descripcion: 'Polera de algodón con escote cuadrado y calce femenino.', imagenUrl: 'https://picsum.photos/seed/polera-cuadrada/800/800', tallas: ['XS', 'S', 'M', 'L'], colores: ['Blanco', 'Negro', 'Rosado'] },
  { nombre: 'Blazer femenino entallado', categoria: 'Blusas', precio: 420, descripcion: 'Blazer entallado con solapa clásica para looks profesionales.', imagenUrl: 'https://picsum.photos/seed/blazer-femenino/800/800', tallas: ['S', 'M', 'L', 'XL'], colores: ['Negro', 'Beige'] },
  { nombre: 'Bolso bandolera acolchado', categoria: 'Accesorios', precio: 295, descripcion: 'Bolso bandolera acolchado con correa ajustable y cierre seguro.', imagenUrl: 'https://picsum.photos/seed/bolso-bandolera/800/800', tallas: ['UNICA'], colores: ['Negro', 'Rosado', 'Beige'] },
  { nombre: 'Cinturón delgado con hebilla', categoria: 'Accesorios', precio: 85, descripcion: 'Cinturón delgado femenino para vestidos y pantalones de cintura alta.', imagenUrl: 'https://picsum.photos/seed/cinturon-fino/800/800', tallas: ['UNICA'], colores: ['Negro', 'Café'] },
  { nombre: 'Aretes argolla dorada', categoria: 'Accesorios', precio: 75, descripcion: 'Aretes de argolla livianos con acabado dorado para uso diario.', imagenUrl: 'https://picsum.photos/seed/aretes-argolla/800/800', tallas: ['UNICA'], colores: ['Amarillo'] },
  { nombre: 'Collar delicado con dije', categoria: 'Accesorios', precio: 95, descripcion: 'Collar femenino de cadena fina con dije minimalista.', imagenUrl: 'https://picsum.photos/seed/collar-dije/800/800', tallas: ['UNICA'], colores: ['Amarillo', 'Rosado'] },
  { nombre: 'Cartera tote de uso diario', categoria: 'Accesorios', precio: 340, descripcion: 'Cartera tote espaciosa para llevar artículos personales con estilo.', imagenUrl: 'https://picsum.photos/seed/cartera-tote/800/800', tallas: ['UNICA'], colores: ['Negro', 'Beige'] },
  { nombre: 'Pañuelo estampado', categoria: 'Accesorios', precio: 65, descripcion: 'Pañuelo cuadrado estampado para cabello, cuello o cartera.', imagenUrl: 'https://picsum.photos/seed/panuelo-estampado/800/800', tallas: ['UNICA'], colores: ['Rosado', 'Azul', 'Amarillo'] },
  { nombre: 'Body manga larga', categoria: 'Blusas', precio: 185, descripcion: 'Body femenino de manga larga con broches y tejido elástico.', imagenUrl: 'https://picsum.photos/seed/body-manga-larga/800/800', tallas: ['XS', 'S', 'M', 'L'], colores: ['Negro', 'Blanco'] },
  { nombre: 'Vestido cruzado corto', categoria: 'Vestidos', precio: 295, descripcion: 'Vestido corto cruzado con falda fluida para ocasiones casuales.', imagenUrl: 'https://picsum.photos/seed/vestido-cruzado-corto/800/800', tallas: ['XS', 'S', 'M', 'L'], colores: ['Rojo', 'Negro'] },
  { nombre: 'Bolso pequeño con cadena', categoria: 'Accesorios', precio: 225, descripcion: 'Bolso compacto femenino con cadena metálica y cierre superior.', imagenUrl: 'https://picsum.photos/seed/bolso-cadena/800/800', tallas: ['UNICA'], colores: ['Negro', 'Beige'] },
  { nombre: 'Pantalón cargo femenino', categoria: 'Pantalones', precio: 265, descripcion: 'Pantalón cargo de mujer con cintura alta y bolsillos laterales.', imagenUrl: 'https://picsum.photos/seed/pantalon-cargo-mujer/800/800', tallas: ['XS', 'S', 'M', 'L', 'XL'], colores: ['Negro', 'Verde'] },
];

const COMMON_PRODUCTS_PER_BRANCH = 10;
const PRODUCTS_PER_BRANCH = 50;
const BRANCH_COLORS = [
  ['Negro', 'Beige', 'Rosado', 'Azul'],
  ['Azul', 'Blanco', 'Rojo', 'Verde'],
  ['Rosado', 'Gris', 'Negro', 'Amarillo'],
  ['Beige', 'Café', 'Verde', 'Blanco'],
];
const APPAREL_SIZES = [
  ['XS', 'S', 'M', 'L'],
  ['S', 'M', 'L', 'XL'],
  ['XS', 'M', 'L', 'XL'],
  ['XS', 'S', 'L', 'XL'],
];
const FOOTWEAR_SIZES = [
  ['36', '37', '38', '39'],
  ['37', '38', '39', '40'],
  ['36', '38', '39', '40'],
  ['36', '37', '39', '40'],
];

// Deja solo letras/números en mayúscula, sin acentos (ej: "Café" -> "CAFE").
const toCode = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const prefix3 = (value: string) => toCode(value).slice(0, 3).padEnd(3, 'X');

@Injectable()
export class ProductsSeed implements OnApplicationBootstrap {
  private readonly logger = new Logger(ProductsSeed.name);

  constructor(
    @InjectRepository(Producto) private readonly productoRepo: Repository<Producto>,
    @InjectRepository(VarianteProducto) private readonly varianteRepo: Repository<VarianteProducto>,
    @InjectRepository(Categoria) private readonly categoriaRepo: Repository<Categoria>,
    @InjectRepository(Talla) private readonly tallaRepo: Repository<Talla>,
    @InjectRepository(Color) private readonly colorRepo: Repository<Color>,
    @InjectRepository(Sucursal) private readonly sucursalRepo: Repository<Sucursal>,
    @InjectRepository(Almacen) private readonly almacenRepo: Repository<Almacen>,
    @InjectRepository(Inventario) private readonly inventarioRepo: Repository<Inventario>,
  ) {}

  // Debe correr tras todos los onModuleInit: necesita categorías/tallas/colores creados por CatalogMasterSeed.
  async onApplicationBootstrap() {
    const sucursales = (await this.sucursalRepo.find()).sort((a, b) => a.idSucursal - b.idSucursal);
    if (!sucursales.length) {
      this.logger.warn('No hay sucursales registradas; los productos se crearán sin inventario.');
    }

    if (PRODUCTS_SEED_DATA.length !== PRODUCTS_PER_BRANCH) {
      throw new Error(`El catálogo base debe tener ${PRODUCTS_PER_BRANCH} productos; tiene ${PRODUCTS_SEED_DATA.length}.`);
    }

    // El seed inicializa un almacén propio por sucursal, nunca todos sus almacenes.
    const almacenPorSucursal = new Map<number, Almacen | null>();
    for (const sucursal of sucursales) {
      const almacen = await this.almacenRepo.findOne({
        where: { sucursal: { idSucursal: sucursal.idSucursal }, codigo: 'PRINCIPAL', estado: true },
      });
      if (!almacen) {
        this.logger.warn(`Sucursal "${sucursal.nombre}" (id ${sucursal.idSucursal}) no tiene almacén PRINCIPAL activo; se omite su inventario.`);
      }
      almacenPorSucursal.set(sucursal.idSucursal, almacen);
    }

    const scopedCatalog = new Map<string, Map<number, { almacen: Almacen; item: ProductSeedItem }>>();
    for (let branchIndex = 0; branchIndex < sucursales.length; branchIndex++) {
      const sucursal = sucursales[branchIndex];
      const almacen = almacenPorSucursal.get(sucursal.idSucursal);
      if (!almacen) continue;
      for (const item of PRODUCTS_SEED_DATA.slice(0, COMMON_PRODUCTS_PER_BRANCH)) {
        await this.seedProducto(item, sucursal, almacen);
        const branchMap = scopedCatalog.get(item.nombre) ?? new Map();
        branchMap.set(sucursal.idSucursal, { almacen, item });
        scopedCatalog.set(item.nombre, branchMap);
      }
      for (const item of PRODUCTS_SEED_DATA.slice(COMMON_PRODUCTS_PER_BRANCH)) {
        const branchItem = this.forBranch(item, sucursal, branchIndex);
        await this.seedProducto(branchItem, sucursal, almacen);
        scopedCatalog.set(branchItem.nombre, new Map([[sucursal.idSucursal, { almacen, item: branchItem }]]));
      }
    }
    await this.retireLegacyCrossBranchStock(scopedCatalog);
  }

  private forBranch(item: ProductSeedItem, sucursal: Sucursal, branchIndex: number): ProductSeedItem {
    const branchName = sucursal.ciudad?.nombre ?? sucursal.nombre;
    const nombre = branchIndex === 0 ? item.nombre : `${item.nombre} (${branchName})`;
    const footwear = item.tallas.some((size) => /^\d+$/.test(size));
    const allowedSizes = footwear ? FOOTWEAR_SIZES[branchIndex % FOOTWEAR_SIZES.length] : APPAREL_SIZES[branchIndex % APPAREL_SIZES.length];
    const tallas = item.tallas[0] === 'UNICA' ? item.tallas : item.tallas.filter((size) => allowedSizes.includes(size));
    const colorPalette = BRANCH_COLORS[branchIndex % BRANCH_COLORS.length];
    const colorStart = (item.colores.length * branchIndex + branchIndex) % colorPalette.length;
    const colores = item.colores.map((_, index) => colorPalette[(colorStart + index) % colorPalette.length]);
    return { ...item, nombre, tallas: tallas.length ? tallas : item.tallas, colores: [...new Set(colores)] };
  }

  private async seedProducto(item: ProductSeedItem, sucursal: Sucursal, almacen: Almacen) {
    const existente = await this.productoRepo.findOne({ where: { nombre: item.nombre } });
    const categoria = await this.categoriaRepo.findOne({ where: { nombre: item.categoria } });
    if (!categoria) {
      this.logger.warn(`Categoría "${item.categoria}" no encontrada; se omite "${item.nombre}".`);
      return;
    }

    const producto = existente ?? await this.productoRepo.save(
      this.productoRepo.create({
        nombre: item.nombre,
        descripcion: item.descripcion,
        precio: item.precio,
        imagenUrl: item.imagenUrl,
        categoria,
      }),
    );
    if (existente && existente.categoria.idCategoria !== categoria.idCategoria) {
      existente.categoria = categoria;
      await this.productoRepo.save(existente);
    }
    this.logger.log(existente ? `Completando variantes e inventario de "${item.nombre}".` : `Producto "${item.nombre}" creado (id ${producto.idProducto}).`);

    const tallas = await this.tallaRepo.find({ where: item.tallas.map((nombre) => ({ nombre })) });
    const colores = await this.colorRepo.find({ where: item.colores.map((nombre) => ({ nombre })) });
    const tallasFaltantes = item.tallas.filter((nombre) => !tallas.some((t) => t.nombre === nombre));
    const coloresFaltantes = item.colores.filter((nombre) => !colores.some((c) => c.nombre === nombre));
    if (tallasFaltantes.length) this.logger.warn(`"${item.nombre}": tallas no encontradas, se omiten: ${tallasFaltantes.join(', ')}`);
    if (coloresFaltantes.length) this.logger.warn(`"${item.nombre}": colores no encontrados, se omiten: ${coloresFaltantes.join(', ')}`);

    let variantesCreadas = 0;
    let inventariosCreados = 0;
    const variantes: VarianteProducto[] = [];
    for (const talla of tallas) {
      for (const color of colores) {
        const base = `${prefix3(categoria.nombre)}-${prefix3(item.nombre.split(' ')[0])}-${toCode(talla.nombre)}-${toCode(color.nombre)}`;
        const sku = await this.buildUniqueSku(base);
        let variante = await this.varianteRepo.findOne({ where: { producto: { idProducto: producto.idProducto }, talla: { idTalla: talla.idTalla }, color: { idColor: color.idColor } } });
        if (!variante) variante = await this.varianteRepo.save(this.varianteRepo.create({ producto, talla, color, sku }));
        variantesCreadas++;
        variantes.push(variante);
      }
    }

    const seedTotal = 14 + ((producto.idProducto * 7 + sucursal.idSucursal * 3) % 7);
    const existingRows = variantes.length
      ? await this.inventarioRepo.find({ where: variantes.map((variante) => ({ almacen: { idAlmacen: almacen.idAlmacen }, variante: { idVariante: variante.idVariante } })) })
      : [];
    for (const row of existingRows) {
      if (row.sucursal.idSucursal !== sucursal.idSucursal) {
        row.sucursal = sucursal;
        await this.inventarioRepo.save(row);
      }
    }
    const existingIds = new Set(existingRows.map((row) => row.variante.idVariante));
    let remainingCapacity = 20;
    for (const row of existingRows.sort((a, b) => a.variante.idVariante - b.variante.idVariante)) {
      const reserved = Number(row.stockReservado);
      const availableCapacity = Math.max(0, remainingCapacity - reserved);
      const adjustedAvailable = Math.min(Number(row.stockDisponible), availableCapacity);
      if (adjustedAvailable !== Number(row.stockDisponible)) {
        row.stockDisponible = adjustedAvailable;
        await this.inventarioRepo.save(row);
      }
      remainingCapacity = Math.max(0, remainingCapacity - reserved - adjustedAvailable);
    }
    const unitsAlreadyPresent = existingRows.reduce((sum, row) => sum + Number(row.stockDisponible) + Number(row.stockReservado), 0);
    if (unitsAlreadyPresent > 20) this.logger.warn(`"${item.nombre}" conserva más de 20 unidades reservadas; no se alteraron reservas activas.`);
    let unitsToSeed = Math.max(0, seedTotal - unitsAlreadyPresent);
    let missingVariants = variantes.filter((variante) => !existingIds.has(variante.idVariante)).length;
    for (const variante of variantes) {
      if (existingIds.has(variante.idVariante)) continue;
      const stockDisponible = missingVariants ? Math.floor(unitsToSeed / missingVariants) : 0;
      await this.inventarioRepo.save(this.inventarioRepo.create({ sucursal, variante, almacen, stockDisponible, stockReservado: 0 }));
      inventariosCreados++;
      unitsToSeed -= stockDisponible;
      missingVariants--;
    }
    this.logger.log(`"${item.nombre}": ${variantesCreadas} variantes y ${inventariosCreados} registros de inventario creados.`);
  }

  private async retireLegacyCrossBranchStock(scopedCatalog: Map<string, Map<number, { almacen: Almacen; item: ProductSeedItem }>>) {
    for (const [productName, branchScopes] of scopedCatalog) {
      const product = await this.productoRepo.findOne({ where: { nombre: productName } });
      if (!product) continue;
      const variants = await this.varianteRepo.find({ where: { producto: { idProducto: product.idProducto } } });
      if (!variants.length) continue;
      const rows = await this.inventarioRepo.find({ where: variants.map((variant) => ({ variante: { idVariante: variant.idVariante } })) });
      const scopeByVariant = new Map<number, Set<number>>();
      for (const variant of variants) {
        const scopeWarehouseIds = new Set<number>();
        for (const [branchId, scope] of branchScopes) {
          const sizeMatches = !variant.talla || scope.item.tallas.includes(variant.talla.nombre);
          const colorMatches = !variant.color || scope.item.colores.includes(variant.color.nombre);
          if (sizeMatches && colorMatches) scopeWarehouseIds.add(scope.almacen.idAlmacen);
        }
        scopeByVariant.set(variant.idVariante, scopeWarehouseIds);
      }
      for (const row of rows) {
        const allowedWarehouses = scopeByVariant.get(row.variante.idVariante);
        if (allowedWarehouses?.has(row.almacen.idAlmacen) && row.almacen.sucursal.idSucursal === row.sucursal.idSucursal) continue;
        if (row.stockDisponible !== 0) {
          row.stockDisponible = 0;
          await this.inventarioRepo.save(row);
        }
      }
    }
  }

  private async buildUniqueSku(base: string): Promise<string> {
    let numero = 1;
    while (true) {
      const candidato = `${base}-${String(numero).padStart(3, '0')}`;
      const existe = await this.varianteRepo.findOne({ where: { sku: candidato } });
      if (!existe) return candidato;
      numero++;
    }
  }
}
