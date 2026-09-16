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
  create(@Body() dto: CreatePagoDto, @Request() req: any) {
    return this.service.create(dto, req.user);
  }

  // Actualiza estado (típicamente lo hace un webhook de la pasarela o el cajero)
  @Patch(':id/estado')
  @Roles(Role.ADMIN, Role.ENCARGADO, Role.ENCARGADO_SUCURSAL, Role.CAJERO)
  updateEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEstadoPagoDto,
    @Request() req: any,
  ) {
    return this.service.updateEstado(id, dto, req.user);
  }

  @Get()
  @Roles(Role.ADMIN, Role.ENCARGADO)
  findAll() {
    return this.service.findAll();
  }

  @Get('venta/:idVenta')
  findByVenta(@Param('idVenta', ParseIntPipe) idVenta: number, @Request() req: any) {
    return this.service.findByVentaAuthorized(idVenta, req.user);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.service.findOneAuthorized(id, req.user);
  }
}
