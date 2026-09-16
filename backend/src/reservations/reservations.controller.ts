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
import { BranchAccessService } from '../users/branch-access.service';

@Controller('reservations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReservationsController {
  constructor(private readonly service: ReservationsService, private readonly access: BranchAccessService) {}

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
  @Roles(Role.ADMIN, Role.ENCARGADO, Role.ENCARGADO_SUCURSAL)
  async findAll(@Request() req:any) {
    const ids=await this.access.accessibleBranchIds(req.user);return ids===null?this.service.findAll():this.service.findAllByBranches(ids);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    const item=await this.service.findOneAuthorized(id, req.user);if([Role.ENCARGADO_SUCURSAL,Role.CAJERO].includes(req.user.rol))await this.access.assertCanAccess(req.user,item.sucursal.idSucursal);return item;
  }

  // Encargado cambia el estado (PREPARADA, ATENDIDA)
  @Patch(':id/estado')
  @Roles(Role.ADMIN, Role.ENCARGADO,Role.ENCARGADO_SUCURSAL)
  async updateEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEstadoReservaDto,
    @Request()req:any,
  ) {
    const item=await this.service.findOne(id);await this.access.assertCanAccess(req.user,item.sucursal.idSucursal);
    return this.service.updateEstado(id, dto);
  }

  // Cancelar reserva (cliente propio o admin)
  @Patch(':id/cancel')
  async cancel(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    if (req.user.rol === Role.ENCARGADO_SUCURSAL) {
      const reserva = await this.service.findOne(id);
      await this.access.assertCanAccess(req.user, reserva.sucursal.idSucursal);
    }
    const esPrivilegiado = [Role.ADMIN, Role.ENCARGADO, Role.ENCARGADO_SUCURSAL].includes(req.user.rol);
    return this.service.cancel(id, req.user.idUsuario, esPrivilegiado);
  }
}
