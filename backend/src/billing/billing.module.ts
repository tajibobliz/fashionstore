import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  BillingController,
  StripeWebhookController,
} from './billing.controller';
import { BillingService } from './billing.service';
import { PagoSuscripcion } from './entities/pago-suscripcion.entity';

/** Global: el registro público (SaasController) también inicia el pago. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([PagoSuscripcion])],
  controllers: [BillingController, StripeWebhookController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
