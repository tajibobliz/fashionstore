import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sucursal } from '../branches/entities/sucursal.entity';
import { VarianteProducto } from '../catalog/entities/variante-producto.entity';
import { Inventario } from '../inventory/entities/inventario.entity';
import { ReservationsModule } from '../reservations/reservations.module';
import { SalesModule } from '../sales/sales.module';
import { UsersModule } from '../users/users.module';
import { Almacen } from '../warehouses/entities/almacen.entity';
import { OperacionSync } from './entities/operacion-sync.entity';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OperacionSync,
      Sucursal,
      Almacen,
      VarianteProducto,
      Inventario,
    ]),
    SalesModule,
    ReservationsModule,
    UsersModule,
  ],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
