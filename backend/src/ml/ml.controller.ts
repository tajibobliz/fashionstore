import { Controller, Get, HttpCode, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { RequiresFeature } from '../tenancy/plan.decorators';
import { DemandaQueryDto } from './dto/ml.dto';
import { MlService } from './ml.service';

/**
 * Analítica con ML (Fase 3, tarea 3.3): solo plan Empresarial (`features.ml`) y roles de
 * gestión de toda la empresa. El id de la empresa sale del JWT.
 */
@ApiTags('Analítica ML')
@ApiBearerAuth()
@Controller('ml')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.ENCARGADO)
@RequiresFeature('ml')
export class MlController {
  constructor(private readonly service: MlService) {}

  /** Genera los datos sintéticos (con el catálogo y ventas reales) y entrena los dos modelos. */
  @Post('entrenar')
  @HttpCode(200)
  entrenar(@Request() req: any) {
    return this.service.entrenar(req.user.idEmpresa);
  }

  @Get('metricas')
  metricas(@Request() req: any) {
    return this.service.metricas(req.user.idEmpresa);
  }

  /** Pronóstico de demanda semanal (total y por producto). */
  @Get('demanda')
  demanda(@Request() req: any, @Query() q: DemandaQueryDto) {
    return this.service.demanda(req.user.idEmpresa, q);
  }

  /** Segmentos de clientes (K-Means sobre RFM). */
  @Get('segmentos')
  segmentos(@Request() req: any) {
    return this.service.segmentos(req.user.idEmpresa);
  }
}
