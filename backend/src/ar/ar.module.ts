import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArService } from './ar.service';
import { ArController } from './ar.controller';
import { InteraccionCliente } from './entities/interaccion-cliente.entity';
import { Producto } from '../catalog/entities/producto.entity';

@Module({
  imports: [TypeOrmModule.forFeature([InteraccionCliente, Producto])],
  controllers: [ArController],
  providers: [ArService],
  exports: [ArService],
})
export class ArModule {}