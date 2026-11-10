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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { CreateCambioDto, PoliticaCambioDto } from './dto/exchanges.dto';
import { ExchangesService } from './exchanges.service';

const ATENCION = [
  Role.ADMIN,
  Role.ENCARGADO,
  Role.ENCARGADO_SUCURSAL,
  Role.CAJERO,
];

/** Cambios de prendas dentro del plazo de la empresa (Fase 2, tarea 2.5). */
@ApiTags('Cambios de prendas')
@ApiBearerAuth()
@Controller('exchanges')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExchangesController {
  constructor(private readonly service: ExchangesService) {}

  /** Plazo de cambio de la empresa (días desde la compra). */
  @Get('politica')
  @Roles(...ATENCION)
  politica(@Request() req: any) {
    return this.service.politica(req.user.idEmpresa);
  }

  @Patch('politica')
  @Roles(Role.ADMIN)
  actualizarPolitica(@Request() req: any, @Body() dto: PoliticaCambioDto) {
    return this.service.actualizarPolitica(
      req.user.idEmpresa,
      dto.plazoCambioDias,
    );
  }

  /** Qué se puede cambiar de una venta y si está dentro del plazo. */
  @Get('venta/:idVenta')
  @Roles(...ATENCION)
  elegibilidad(
    @Request() req: any,
    @Param('idVenta', ParseIntPipe) idVenta: number,
  ) {
    return this.service.elegibilidad(req.user, idVenta);
  }

  @Get()
  @Roles(...ATENCION)
  listar(@Request() req: any) {
    return this.service.listar(req.user);
  }

  @Post()
  @Roles(...ATENCION)
  crear(@Request() req: any, @Body() dto: CreateCambioDto) {
    return this.service.crear(req.user, dto);
  }
}
