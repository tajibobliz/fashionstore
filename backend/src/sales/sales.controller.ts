import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateVentaCarritoDto } from './dto/create-venta-carrito.dto';
import { CreateVentaPresencialDto } from './dto/create-venta-presencial.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';

@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesController {
  constructor(private readonly service: SalesService) {}

  // Cliente compra desde su carrito (digital)
  @Post('from-cart')
  createFromCart(@Request() req: any, @Body() dto: CreateVentaCarritoDto) {
    return this.service.createFromCart(req.user.idUsuario, dto);
  }

  // Cajero registra venta presencial
  @Post('presencial')
  @Roles(Role.CAJERO, Role.ADMIN)
  createPresencial(@Request() req: any, @Body() dto: CreateVentaPresencialDto) {
    return this.service.createPresencial(req.user.idUsuario, dto);
  }

  // Mis ventas (cliente)
  @Get('me')
  findMine(@Request() req: any) {
    return this.service.findByUsuario(req.user.idUsuario);
  }

  // Todas las ventas (admin/encargado)
  @Get()
  @Roles(Role.ADMIN, Role.ENCARGADO)
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  // Confirmar venta pendiente (después de pago aprobado)
  @Patch(':id/confirmar')
  @Roles(Role.ADMIN, Role.CAJERO)
  confirmar(@Param('id', ParseIntPipe) id: number) {
    return this.service.confirmar(id);
  }

  // Cancelar venta pendiente
  @Patch(':id/cancelar')
  cancelar(@Param('id', ParseIntPipe) id: number) {
    return this.service.cancelar(id);
  }
}