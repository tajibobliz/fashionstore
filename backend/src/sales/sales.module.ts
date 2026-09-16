import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { Venta } from './entities/venta.entity';
import { DetalleVenta } from './entities/detalle-venta.entity';
import { Sucursal } from '../branches/entities/sucursal.entity';
import { VarianteProducto } from '../catalog/entities/variante-producto.entity';
import { Producto } from '../catalog/entities/producto.entity';
import { Inventario } from '../inventory/entities/inventario.entity';
import { MovimientoInventario } from '../inventory/entities/movimiento-inventario.entity';
import { Carrito } from '../cart/entities/carrito.entity';
import { Almacen } from '../warehouses/entities/almacen.entity';
import { PosModule } from '../pos/pos.module';
import { UsersModule } from '../users/users.module';
import { PromotionsModule } from '../promotions/promotions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Venta,
      DetalleVenta,
      Sucursal,
      VarianteProducto,
      Producto,
      Inventario,
      MovimientoInventario,
      Carrito,
      Almacen,
    ]),
    PosModule,
    UsersModule,
    PromotionsModule,
  ],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
