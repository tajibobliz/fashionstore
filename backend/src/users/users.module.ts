import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { Rol } from './entities/rol.entity';
import { Usuario } from './entities/user.entity';
import { RolesSeed } from './seeds/roles.seed';
import { AdminSeed } from './seeds/admin.seed';

@Module({
  imports: [TypeOrmModule.forFeature([Rol, Usuario])],
  controllers: [UsersController],
  providers: [UsersService, RolesSeed, AdminSeed],
  exports: [UsersService],
})
export class UsersModule {}