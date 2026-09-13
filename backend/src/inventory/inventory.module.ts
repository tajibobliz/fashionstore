import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { Inventario } from './entities/inventario.entity';
import { MovimientoInventario } from './entities/movimiento-inventario.entity';
import { Sucursal } from '../branches/entities/sucursal.entity';
import { VarianteProducto } from '../catalog/entities/variante-producto.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Inventario,
      MovimientoInventario,
      Sucursal,
      VarianteProducto,
    ]),
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
})
export class InventoryModule {}