import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { SubscriptionsService } from './subscriptions.service';
import { CambiarPlanDto } from './dto/platform.dto';
import { AllowWithoutSubscription } from './plan.decorators';

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

  /** El administrador cambia o renueva su plan (contratación simulada, sin cobro real). */
  @Post('suscripcion')
  @Roles(Role.ADMIN)
  @AllowWithoutSubscription()
  cambiarPlan(@Request() req: any, @Body() dto: CambiarPlanDto) {
    return this.service.cambiarPlan(
      req.user.idEmpresa,
      dto.codigoPlan,
      dto.meses,
    );
  }

  @Get('suscripciones')
  @Roles(Role.ADMIN)
  historial(@Request() req: any) {
    return this.service.historial(req.user.idEmpresa);
  }
}
