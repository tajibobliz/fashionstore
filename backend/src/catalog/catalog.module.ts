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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Categoria,
      Talla,
      Color,
      Temporada,
      Proveedor,
      Coleccion,
      Producto,
      VarianteProducto,
    ]),
  ],
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}