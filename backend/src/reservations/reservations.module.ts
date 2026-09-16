import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReservationsService } from './reservations.service';
import { ReservationsController } from './reservations.controller';
import { Reserva } from './entities/reserva.entity';
import { DetalleReserva } from './entities/detalle-reserva.entity';
import { Sucursal } from '../branches/entities/sucursal.entity';
import { VarianteProducto } from '../catalog/entities/variante-producto.entity';
import { Inventario } from '../inventory/entities/inventario.entity';
import { MovimientoInventario } from '../inventory/entities/movimiento-inventario.entity';
import { InventoryModule } from '../inventory/inventory.module';
import { Almacen } from '../warehouses/entities/almacen.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Reserva,
      DetalleReserva,
      Sucursal,
      VarianteProducto,
      Inventario,
      MovimientoInventario,
      Almacen,
    ]),
    InventoryModule,
    UsersModule,
  ],
  controllers: [ReservationsController],
  providers: [ReservationsService],
})
export class ReservationsModule {}
