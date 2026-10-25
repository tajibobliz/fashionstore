import { Global, Logger, Module, OnModuleInit } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { InjectDataSource, TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Plan } from './entities/plan.entity';
import { Empresa } from './entities/empresa.entity';
import { Suscripcion } from './entities/suscripcion.entity';
import { TenantSubscriber } from './tenant.subscriber';
import { TenantResolverService } from './tenant-resolver.service';
import { TenantContextInterceptor } from './tenant-context.interceptor';
import { installTenantRls } from './tenant-rls';
import { PlanService } from './plan.service';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionInterceptor } from './subscription.interceptor';
import { PlatformController } from './platform.controller';
import { TenantController } from './tenant.controller';

/** Módulo SaaS: empresas (tenants), planes, suscripciones y aislamiento por empresa. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Plan, Empresa, Suscripcion])],
  providers: [
    TenantResolverService,
    TenantSubscriber,
    PlanService,
    SubscriptionsService,
    // El orden importa: primero se decide la empresa, después se aplica su plan.
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
    { provide: APP_INTERCEPTOR, useClass: SubscriptionInterceptor },
  ],
  controllers: [PlatformController, TenantController],
  exports: [TypeOrmModule, TenantResolverService, PlanService],
})
export class TenancyModule implements OnModuleInit {
  private readonly logger = new Logger('TenancyModule');

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    installTenantRls();
  }

  /** Avisa (RNF10) si la BD no va a aplicar el aislamiento por empresa. */
  async onModuleInit() {
    try {
      const [role] = await this.dataSource.query(
        `SELECT rolsuper OR rolbypassrls AS bypass FROM pg_roles WHERE rolname = current_user`,
      );
      const [table] = await this.dataSource.query(
        `SELECT relrowsecurity AS rls FROM pg_class WHERE relname = 'venta' AND relkind = 'r'`,
      );
      if (!table?.rls) {
        this.logger.warn(
          'RLS no está activo en la BD: ejecuta las migraciones (EnableTenantRowLevelSecurity).',
        );
      } else if (role?.bypass) {
        this.logger.warn(
          'El usuario de BD es superusuario o BYPASSRLS: PostgreSQL NO aplicará el aislamiento por empresa. ' +
            'Usa un rol normal (backend/scripts/crear-rol-app.sql).',
        );
      } else {
        this.logger.log(
          'Aislamiento por empresa activo en la base de datos (RLS).',
        );
      }
    } catch (error) {
      this.logger.warn(`No se pudo verificar RLS: ${(error as Error).message}`);
    }
  }
}
