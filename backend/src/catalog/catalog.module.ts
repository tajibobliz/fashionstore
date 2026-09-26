import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogService } from './catalog.service';
import { CatalogController } from './catalog.controller';
import { Categoria } from './entities/categoria.entity';
import { Talla } from './entities/talla.entity';
import { Color } from './entities/color.entity';
import { Temporada } from './entities/temporada.entity';
import { Proveedor } from './entities/proveedor.entity';
import { Coleccion } from './entities/coleccion.entity';
import { Producto } from './entities/producto.entity';
import { VarianteProducto } from './entities/variante-producto.entity';
import { Sucursal } from '../branches/entities/sucursal.entity';
import { Almacen } from '../warehouses/entities/almacen.entity';
import { Inventario } from '../inventory/entities/inventario.entity';
import { ProductsSeed } from './seeds/products.seed';
import { ImagenVariante } from './entities/imagen-variante.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([
      Categoria,
      Talla,
      Color,
      Temporada,
      Proveedor,
      Coleccion,
      Producto,
      VarianteProducto,
      Sucursal,
      Almacen,
      Inventario,
      ImagenVariante,
    ]),
  ],
  controllers: [CatalogController],
  providers: [CatalogService, ProductsSeed],
})
export class CatalogModule {}
