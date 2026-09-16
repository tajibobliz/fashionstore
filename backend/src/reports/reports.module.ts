import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { Venta } from '../sales/entities/venta.entity';
import { DetalleVenta } from '../sales/entities/detalle-venta.entity';
import { Reserva } from '../reservations/entities/reserva.entity';
import { Inventario } from '../inventory/entities/inventario.entity';
import { Producto } from '../catalog/entities/producto.entity';
import { Usuario } from '../users/entities/user.entity';
import { Pago } from '../payments/entities/pago.entity';
import { TurnoCaja } from '../pos/entities/turno-caja.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Venta,
      DetalleVenta,
      Reserva,
      Inventario,
      Producto,
      Usuario,
      Pago,
      TurnoCaja,
    ]),
    UsersModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
