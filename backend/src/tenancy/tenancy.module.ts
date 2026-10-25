import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Plan } from './entities/plan.entity';
import { Empresa } from './entities/empresa.entity';
import { Suscripcion } from './entities/suscripcion.entity';
import { TenantSubscriber } from './tenant.subscriber';

/** Módulo SaaS: empresas (tenants), planes y suscripciones. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Plan, Empresa, Suscripcion])],
  providers: [TenantSubscriber],
  exports: [TypeOrmModule],
})
export class TenancyModule {}
