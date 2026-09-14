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
import { ReservationsService } from './reservations.service';
import { CreateReservaDto } from './dto/create-reserva.dto';
import { UpdateEstadoReservaDto } from './dto/update-estado.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';

@Controller('reservations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReservationsController {
  constructor(private readonly service: ReservationsService) {}

  // Cliente crea una reserva
  @Post()
  create(@Request() req: any, @Body() dto: CreateReservaDto) {
    return this.service.create(req.user.idUsuario, dto);
  }

  // Cliente ve sus propias reservas
  @Get('me')
  findMine(@Request() req: any) {
    return this.service.findByUsuario(req.user.idUsuario);
  }

  // Admin/encargado ven todas
  @Get()
  @Roles(Role.ADMIN, Role.ENCARGADO)
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  // Encargado cambia el estado (PREPARADA, ATENDIDA)
  @Patch(':id/estado')
  @Roles(Role.ADMIN, Role.ENCARGADO)
  updateEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEstadoReservaDto,
  ) {
    return this.service.updateEstado(id, dto);
  }

  // Cancelar reserva (cliente propio o admin)
  @Patch(':id/cancel')
  cancel(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    const esAdmin = req.user.rol === 'ADMIN';
    return this.service.cancel(id, req.user.idUsuario, esAdmin);
  }
}