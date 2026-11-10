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
import {
  MonedaEmpresaDto,
  PortadaTiendaDto,
  SesionOfflineDto,
} from './dto/platform.dto';

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

  /** Plazo máximo (horas) para operar sin conexión con el PIN local (CU17). */
  @Patch('sesion-offline')
  @Roles(Role.ADMIN)
  cambiarSesionOffline(@Request() req: any, @Body() dto: SesionOfflineDto) {
    return this.service.cambiarSesionOffline(
      req.user.idEmpresa,
      dto.horasSesionOffline,
    );
  }

  /** Imagen grande y frase de la portada de la tienda online (/t/:slug). */
  @Patch('portada')
  @Roles(Role.ADMIN)
  cambiarPortada(@Request() req: any, @Body() dto: PortadaTiendaDto) {
    return this.service.cambiarPortada(req.user.idEmpresa, dto);
  }

  @Get('suscripciones')
  @Roles(Role.ADMIN)
  historial(@Request() req: any) {
    return this.service.historial(req.user.idEmpresa);
  }
}
