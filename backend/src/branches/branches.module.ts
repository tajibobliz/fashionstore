import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BranchesService } from './branches.service';
import { BranchesController } from './branches.controller';
import { Ciudad } from './entities/ciudad.entity';
import { Sucursal } from './entities/sucursal.entity';
import { Almacen } from '../warehouses/entities/almacen.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Ciudad, Sucursal,Almacen])],
  controllers: [BranchesController],
  providers: [BranchesService],
})
export class BranchesModule {}
