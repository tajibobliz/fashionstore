import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromotionsService } from './promotions.service';
import { PromotionsController } from './promotions.controller';
import { Promocion } from './entities/promocion.entity';
import { Producto } from '../catalog/entities/producto.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Promocion, Producto])],
  controllers: [PromotionsController],
  providers: [PromotionsService],
})
export class PromotionsModule {}