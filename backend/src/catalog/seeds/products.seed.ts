import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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

// NOTA: el array tiene 25 productos (5+5+4+3+2+3+3), no 24 como decía el pedido original.
const PRODUCTS_SEED_DATA: ProductSeedItem[] = [
  { nombre: 'Zapato tacón bajo', categoria: 'Zapatos', precio: 350.0, descripcion: 'Zapato de tacón bajo elegante para el día a día.', imagenUrl: "https://cdn.dummyjson.com/product-images/womens-shoes/black-&-brown-slipper/thumbnail.webp", tallas: ['36', '37', '38', '39', '40'], colores: ['Negro', 'Beige'] },
  { nombre: 'Bota corta café', categoria: 'Zapatos', precio: 420.0, descripcion: 'Bota corta de cuero café, perfecta para otoño.', imagenUrl: "https://cdn.dummyjson.com/product-images/womens-shoes/calvin-klein-heel-shoes/thumbnail.webp", tallas: ['36', '37', '38', '39', '40'], colores: ['Café'] },
  { nombre: 'Tenis blanco urbano', categoria: 'Zapatos', precio: 380.0, descripcion: 'Tenis blanco casual para el día a día.', imagenUrl: "https://cdn.dummyjson.com/product-images/womens-shoes/golden-shoes-woman/thumbnail.webp", tallas: ['36', '37', '38', '39', '40'], colores: ['Blanco'] },
  { nombre: 'Sandalia verano', categoria: 'Zapatos', precio: 280.0, descripcion: 'Sandalia ligera ideal para clima cálido.', imagenUrl: "https://cdn.dummyjson.com/product-images/womens-shoes/pampi-shoes/thumbnail.webp", tallas: ['36', '37', '38', '39', '40'], colores: ['Beige', 'Negro'] },
  { nombre: 'Botín taco alto', categoria: 'Zapatos', precio: 490.0, descripcion: 'Botín de taco alto para looks nocturnos.', imagenUrl: "https://cdn.dummyjson.com/product-images/womens-shoes/red-shoes/thumbnail.webp", tallas: ['36', '37', '38', '39', '40'], colores: ['Negro', 'Rojo'] },

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
  { nombre: 'Bufanda tejida', categoria: 'Accesorios', precio: 90.0, descripcion: 'Bufanda tejida a mano, cálida y suave.', imagenUrl: 'https://picsum.photos/seed/bufanda-tejida/800/800', tallas: ['UNICA'], colores: ['Rosado', 'Beige', 'Gris'] },
];

// Deja solo letras/números en mayúscula, sin acentos (ej: "Café" -> "CAFE").
const toCode = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const prefix3 = (value: string) => toCode(value).slice(0, 3).padEnd(3, 'X');

@Injectable()
export class ProductsSeed implements OnModuleInit {
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

  async onModuleInit() {
    const sucursales = await this.sucursalRepo.find();
    if (!sucursales.length) {
      this.logger.warn('No hay sucursales registradas; los productos se crearán sin inventario.');
    }

    // Resuelve una vez el almacén PRINCIPAL de cada sucursal (mismo criterio que InventoryService.createInventario).
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

    for (const item of PRODUCTS_SEED_DATA) {
      await this.seedProducto(item, sucursales, almacenPorSucursal);
    }
  }

  private async seedProducto(item: ProductSeedItem, sucursales: Sucursal[], almacenPorSucursal: Map<number, Almacen | null>) {
    const existente = await this.productoRepo.findOne({ where: { nombre: item.nombre } });
    if (existente) {
      this.logger.log(`Producto "${item.nombre}" ya existe, se omite.`);
      return;
    }

    const categoria = await this.categoriaRepo.findOne({ where: { nombre: item.categoria } });
    if (!categoria) {
      this.logger.warn(`Categoría "${item.categoria}" no encontrada; se omite "${item.nombre}".`);
      return;
    }

    const producto = await this.productoRepo.save(
      this.productoRepo.create({
        nombre: item.nombre,
        descripcion: item.descripcion,
        precio: item.precio,
        imagenUrl: item.imagenUrl,
        categoria,
      }),
    );
    this.logger.log(`Producto "${item.nombre}" creado (id ${producto.idProducto}).`);

    const tallas = await this.tallaRepo.find({ where: item.tallas.map((nombre) => ({ nombre })) });
    const colores = await this.colorRepo.find({ where: item.colores.map((nombre) => ({ nombre })) });
    const tallasFaltantes = item.tallas.filter((nombre) => !tallas.some((t) => t.nombre === nombre));
    const coloresFaltantes = item.colores.filter((nombre) => !colores.some((c) => c.nombre === nombre));
    if (tallasFaltantes.length) this.logger.warn(`"${item.nombre}": tallas no encontradas, se omiten: ${tallasFaltantes.join(', ')}`);
    if (coloresFaltantes.length) this.logger.warn(`"${item.nombre}": colores no encontrados, se omiten: ${coloresFaltantes.join(', ')}`);

    let variantesCreadas = 0;
    let inventariosCreados = 0;
    for (const talla of tallas) {
      for (const color of colores) {
        const base = `${prefix3(categoria.nombre)}-${prefix3(item.nombre.split(' ')[0])}-${toCode(talla.nombre)}-${toCode(color.nombre)}`;
        const sku = await this.buildUniqueSku(base);
        const variante = await this.varianteRepo.save(this.varianteRepo.create({ producto, talla, color, sku }));
        variantesCreadas++;

        for (const sucursal of sucursales) {
          const almacen = almacenPorSucursal.get(sucursal.idSucursal);
          if (!almacen) continue;
          const stockDisponible = 5 + Math.floor(Math.random() * 21); // 5-25 inclusive
          await this.inventarioRepo.save(
            this.inventarioRepo.create({ sucursal, variante, almacen, stockDisponible, stockReservado: 0 }),
          );
          inventariosCreados++;
        }
      }
    }
    this.logger.log(`"${item.nombre}": ${variantesCreadas} variantes y ${inventariosCreados} registros de inventario creados.`);
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
