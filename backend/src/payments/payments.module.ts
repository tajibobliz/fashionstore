import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { StorePaymentsService } from './store-payments.service';
import { Pago } from './entities/pago.entity';
import { ConfigPagoTienda } from './entities/config-pago-tienda.entity';
import { ComprobantePago } from './entities/comprobante-pago.entity';
import { Venta } from '../sales/entities/venta.entity';
import { SalesModule } from '../sales/sales.module';
import { UsersModule } from '../users/users.module';

/**
 * Pagos de ventas. El antiguo simulador público (/mock-gateway) se retiró: permitía aprobar
 * cualquier pago sin autenticación. La tarjeta ahora pasa por Stripe (o la pasarela simulada
 * protegida) y el resto de medios los aprueba el personal.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Pago, Venta, ConfigPagoTienda, ComprobantePago]),
    SalesModule,
    UsersModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, StorePaymentsService],
})
export class PaymentsModule {}
