import {
  Body,
  Controller,
  Get,
  Patch,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { SubscriptionsService } from './subscriptions.service';
import { MonedaEmpresaDto } from './dto/platform.dto';

/** Datos de la empresa del usuario logueado: plan, vigencia, límites y uso. */
@ApiTags('Mi empresa (SaaS)')
@ApiBearerAuth()
@Controller('tenant')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantController {
  constructor(private readonly service: SubscriptionsService) {}

  @Get('me')
  @Roles(Role.ADMIN, Role.ENCARGADO, Role.ENCARGADO_SUCURSAL, Role.CAJERO)
  me(@Request() req: any) {
    return this.service.resumen(req.user.idEmpresa);
  }

  /**
   * El administrador elige la moneda en la que vende su tienda. No convierte precios:
   * solo cambia cómo se muestran y cobran los montos (la tienda ajusta sus precios si hace falta).
   */
  @Patch('moneda')
  @Roles(Role.ADMIN)
  cambiarMoneda(@Request() req: any, @Body() dto: MonedaEmpresaDto) {
    return this.service.cambiarMoneda(req.user.idEmpresa, dto.moneda);
  }

  @Get('suscripciones')
  @Roles(Role.ADMIN)
  historial(@Request() req: any) {
    return this.service.historial(req.user.idEmpresa);
  }
}
