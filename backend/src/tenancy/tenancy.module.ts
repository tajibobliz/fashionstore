import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Plan } from './entities/plan.entity';
import { Empresa } from './entities/empresa.entity';
import { Suscripcion } from './entities/suscripcion.entity';
import { TenantSubscriber } from './tenant.subscriber';
import { TenantResolverService } from './tenant-resolver.service';
import { TenantContextInterceptor } from './tenant-context.interceptor';

/** Módulo SaaS: empresas (tenants), planes y suscripciones. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Plan, Empresa, Suscripcion])],
  providers: [
    TenantResolverService,
    TenantSubscriber,
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
  ],
  exports: [TypeOrmModule, TenantResolverService],
})
export class TenancyModule {}
