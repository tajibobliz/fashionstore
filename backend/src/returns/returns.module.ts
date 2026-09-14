import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReturnsService } from './returns.service';
import { ReturnsController } from './returns.controller';
import { Devolucion } from './entities/devolucion.entity';
import { DetalleDevolucion } from './entities/detalle-devolucion.entity';
import { Venta } from '../sales/entities/venta.entity';
import { DetalleVenta } from '../sales/entities/detalle-venta.entity';
import { Inventario } from '../inventory/entities/inventario.entity';
import { MovimientoInventario } from '../inventory/entities/movimiento-inventario.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Devolucion,
      DetalleDevolucion,
      Venta,
      DetalleVenta,
      Inventario,
      MovimientoInventario,
    ]),
  ],
  controllers: [ReturnsController],
  providers: [ReturnsService],
})
export class ReturnsModule {}