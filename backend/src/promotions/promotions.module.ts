import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromotionsService } from './promotions.service';
import { PromotionsController } from './promotions.controller';
import { Promocion } from './entities/promocion.entity';
import { Producto } from '../catalog/entities/producto.entity';
import { Categoria } from '../catalog/entities/categoria.entity';
import { Temporada } from '../catalog/entities/temporada.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Promocion, Producto, Categoria, Temporada])],
  controllers: [PromotionsController],
  providers: [PromotionsService],
  exports: [PromotionsService],
})
export class PromotionsModule {}
