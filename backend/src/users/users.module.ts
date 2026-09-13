import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { Rol } from './entities/rol.entity';
import { Usuario } from './entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Rol, Usuario])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // ← IMPORTANTE: para que auth pueda usarlo
})
export class UsersModule {}