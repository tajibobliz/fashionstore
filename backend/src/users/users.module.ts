import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { Rol } from './entities/rol.entity';
import { Usuario } from './entities/user.entity';
import { RolesSeed } from './seeds/roles.seed';
import { AdminSeed } from './seeds/admin.seed';
import { UsuarioSucursal } from './entities/usuario-sucursal.entity';
import { Sucursal } from '../branches/entities/sucursal.entity';
import { BranchAccessService } from './branch-access.service';

@Module({
  imports: [TypeOrmModule.forFeature([Rol, Usuario, UsuarioSucursal, Sucursal])],
  controllers: [UsersController],
  providers: [UsersService, RolesSeed, AdminSeed, BranchAccessService],
  exports: [UsersService, BranchAccessService, TypeOrmModule],
})
export class UsersModule {}
