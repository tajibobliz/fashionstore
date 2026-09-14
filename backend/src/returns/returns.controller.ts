import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ReturnsService } from './returns.service';
import { CreateDevolucionDto } from './dto/create-devolucion.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';

@Controller('returns')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReturnsController {
  constructor(private readonly service: ReturnsService) {}

  // Cajero o encargado registra una devolución
  @Post()
  @Roles(Role.CAJERO, Role.ENCARGADO, Role.ADMIN)
  create(@Request() req: any, @Body() dto: CreateDevolucionDto) {
    return this.service.create(req.user.idUsuario, dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.ENCARGADO)
  findAll() {
    return this.service.findAll();
  }

  @Get('venta/:idVenta')
  @Roles(Role.ADMIN, Role.ENCARGADO, Role.CAJERO)
  findByVenta(@Param('idVenta', ParseIntPipe) idVenta: number) {
    return this.service.findByVenta(idVenta);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.ENCARGADO, Role.CAJERO)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }
}