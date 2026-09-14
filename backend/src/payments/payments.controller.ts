import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePagoDto } from './dto/create-pago.dto';
import { UpdateEstadoPagoDto } from './dto/update-estado-pago.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  // Registra un pago (lo hace el sistema/frontend después de la pasarela)
  @Post()
  create(@Body() dto: CreatePagoDto) {
    return this.service.create(dto);
  }

  // Actualiza estado (típicamente lo hace un webhook de la pasarela o el cajero)
  @Patch(':id/estado')
  @Roles(Role.ADMIN, Role.CAJERO)
  updateEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEstadoPagoDto,
  ) {
    return this.service.updateEstado(id, dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.ENCARGADO)
  findAll() {
    return this.service.findAll();
  }

  @Get('venta/:idVenta')
  findByVenta(@Param('idVenta', ParseIntPipe) idVenta: number) {
    return this.service.findByVenta(idVenta);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }
}