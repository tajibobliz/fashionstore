import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BranchesService } from './branches.service';
import { BranchesController } from './branches.controller';
import { Ciudad } from './entities/ciudad.entity';
import { Sucursal } from './entities/sucursal.entity';
import { Almacen } from '../warehouses/entities/almacen.entity';
import { Caja } from '../pos/entities/caja.entity';
import { Rol } from '../users/entities/rol.entity';
import { Usuario } from '../users/entities/user.entity';
import { UsuarioSucursal } from '../users/entities/usuario-sucursal.entity';
import { ConfigModule } from '@nestjs/config';
import { DemoCommerceSeed } from './seeds/demo-commerce.seed';
import { CatalogMasterSeed } from '../catalog/seeds/catalog-master.seed';
import { Categoria } from '../catalog/entities/categoria.entity';
import { Talla } from '../catalog/entities/talla.entity';
import { Color } from '../catalog/entities/color.entity';
import { RolesSeed } from '../users/seeds/roles.seed';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Ciudad, Sucursal, Almacen, Caja, Rol, Usuario, UsuarioSucursal, Categoria, Talla, Color])],
  controllers: [BranchesController],
  providers: [BranchesService, CatalogMasterSeed, RolesSeed, DemoCommerceSeed],
})
export class BranchesModule {}
