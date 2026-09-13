import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { Rol } from './entities/rol.entity';
import { Usuario } from './entities/user.entity';
import { RolesSeed } from './seeds/roles.seed';

@Module({
  imports: [
    TypeOrmModule.forFeature([Rol, Usuario]),
    PassportModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, RolesSeed],
  exports: [UsersService],
})
export class UsersModule {}