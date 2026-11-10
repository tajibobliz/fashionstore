import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { Carrito } from './entities/carrito.entity';
import { DetalleCarrito } from './entities/detalle-carrito.entity';
import { VarianteProducto } from '../catalog/entities/variante-producto.entity';
import { Producto } from '../catalog/entities/producto.entity';
import { Sucursal } from '../branches/entities/sucursal.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Carrito,
      DetalleCarrito,
      VarianteProducto,
      Producto,
      Sucursal,
    ]),
  ],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}