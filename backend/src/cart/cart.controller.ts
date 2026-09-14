import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AddItemDto } from './dto/add-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly service: CartService) {}

  @Get('me')
  getMyCart(@Request() req: any) {
    return this.service.getMyCart(req.user.idUsuario);
  }

  @Get('me/total')
  getTotal(@Request() req: any) {
    return this.service
      .getTotal(req.user.idUsuario)
      .then((total) => ({ total }));
  }

  @Post('items')
  addItem(@Request() req: any, @Body() dto: AddItemDto) {
    return this.service.addItem(req.user.idUsuario, dto);
  }

  @Patch('items/:id')
  updateItem(
    @Request() req: any,
    @Param('id', ParseIntPipe) idDetalle: number,
    @Body() dto: UpdateItemDto,
  ) {
    return this.service.updateItem(req.user.idUsuario, idDetalle, dto);
  }

  @Delete('items/:id')
  removeItem(
    @Request() req: any,
    @Param('id', ParseIntPipe) idDetalle: number,
  ) {
    return this.service.removeItem(req.user.idUsuario, idDetalle);
  }

  @Delete('me')
  clear(@Request() req: any) {
    return this.service.clear(req.user.idUsuario);
  }
}