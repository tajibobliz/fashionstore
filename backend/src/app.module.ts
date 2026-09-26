import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { BranchesModule } from './branches/branches.module';
import { CatalogModule } from './catalog/catalog.module';
import { InventoryModule } from './inventory/inventory.module';
import { ReservationsModule } from './reservations/reservations.module';
import { CartModule } from './cart/cart.module';
import { SalesModule } from './sales/sales.module';
import { PaymentsModule } from './payments/payments.module';
import { ReturnsModule } from './returns/returns.module';
import { ArModule } from './ar/ar.module';
import { AiModule } from './ai/ai.module';
import { ReportsModule } from './reports/reports.module';
import { PromotionsModule } from './promotions/promotions.module';
import { WarehousesModule } from './warehouses/warehouses.module';
import { PosModule } from './pos/pos.module';
import { NotificationsModule } from './notifications/notifications.module';
import { databaseSsl, validateEnvironment } from './config/environment';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnvironment,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_NAME'),
        ssl: databaseSsl(config.get<string>('DB_SSL')),
        autoLoadEntities: true,
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        migrationsRun: config.get<string>('DB_MIGRATIONS_RUN') === 'true' || config.get<string>('NODE_ENV') === 'production',
        synchronize:
          config.get<string>('NODE_ENV') === 'production'
            ? false
            : config.get<string>('DB_SYNCHRONIZE') !== undefined
            ? config.get<string>('DB_SYNCHRONIZE') === 'true'
            : false,
      }),
    }),
    UsersModule,
    AuthModule,
    BranchesModule,
    CatalogModule,
    InventoryModule,
    ReservationsModule,
    CartModule,
    SalesModule,
    PaymentsModule,
    ReturnsModule,
    ArModule,
    AiModule,
    ReportsModule,
    PromotionsModule,
    WarehousesModule,
    PosModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
