import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { InteraccionCliente } from '../ar/entities/interaccion-cliente.entity';
import { Producto } from '../catalog/entities/producto.entity';
import { DetalleVenta } from '../sales/entities/detalle-venta.entity';
import { Categoria } from '../catalog/entities/categoria.entity';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InteraccionCliente,
      Producto,
      DetalleVenta,
      Categoria,
    ]),
    ReportsModule,
  ],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}