import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Venta } from '../sales/entities/venta.entity';
import { SalesModule } from '../sales/sales.module';
import { Empresa } from '../tenancy/entities/empresa.entity';
import { UsersModule } from '../users/users.module';
import { Cambio } from './entities/cambio.entity';
import { DetalleCambio } from './entities/detalle-cambio.entity';
import { ExchangesController } from './exchanges.controller';
import { ExchangesService } from './exchanges.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cambio, DetalleCambio, Venta, Empresa]),
    SalesModule,
    UsersModule,
  ],
  controllers: [ExchangesController],
  providers: [ExchangesService],
})
export class ExchangesModule {}
