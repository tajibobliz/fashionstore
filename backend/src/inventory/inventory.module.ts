import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { Inventario } from './entities/inventario.entity';
import { MovimientoInventario } from './entities/movimiento-inventario.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Inventario, MovimientoInventario])],
  controllers: [InventoryController],
  providers: [InventoryService],
})
export class InventoryModule {}