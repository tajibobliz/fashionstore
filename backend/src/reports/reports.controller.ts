import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.ENCARGADO)
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('resumen')
  getResumen() {
    return this.service.getResumenGeneral();
  }

  @Get('ventas-por-dia')
  getVentasPorDia(
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.service.getVentasPorDia(desde, hasta);
  }

  @Get('top-productos')
  getTopProductos(@Query('limit') limit?: string) {
    const n = limit ? parseInt(limit, 10) : 10;
    return this.service.getTopProductosVendidos(n);
  }

  @Get('ventas-por-sucursal')
  getVentasPorSucursal() {
    return this.service.getVentasPorSucursal();
  }

  @Get('inventario-critico')
  getInventarioCritico(@Query('umbral') umbral?: string) {
    const n = umbral ? parseInt(umbral, 10) : 5;
    return this.service.getInventarioCritico(n);
  }

  @Get('reservas-por-estado')
  getReservasPorEstado() {
    return this.service.getReservasPorEstado();
  }
}