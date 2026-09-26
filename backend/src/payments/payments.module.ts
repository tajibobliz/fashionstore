import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { MockGatewayController } from './mock-gateway.controller';
import { Pago } from './entities/pago.entity';
import { Venta } from '../sales/entities/venta.entity';
import { SalesModule } from '../sales/sales.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Pago, Venta]),
    SalesModule,
    UsersModule,
  ],
  controllers: [PaymentsController, MockGatewayController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
