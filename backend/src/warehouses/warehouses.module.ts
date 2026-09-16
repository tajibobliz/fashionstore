import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Almacen } from './entities/almacen.entity';
import { Sucursal } from '../branches/entities/sucursal.entity';
import { WarehousesService } from './warehouses.service';
import { WarehousesController } from './warehouses.controller';
import { UsersModule } from '../users/users.module';
@Module({imports:[TypeOrmModule.forFeature([Almacen,Sucursal]),UsersModule],providers:[WarehousesService],controllers:[WarehousesController],exports:[WarehousesService,TypeOrmModule]})
export class WarehousesModule {}
