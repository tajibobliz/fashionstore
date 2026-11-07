import { Body, Controller, Get, HttpCode, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../auth/enums/role.enum';
import { RequiresFeature } from '../../tenancy/plan.decorators';
import { ConsultaReporteDto } from './dto/consulta-reporte.dto';
import { AiReportsService } from './ai-reports.service';

/**
 * Reportes generativos con IA (Fase 3, tarea 3.1).
 * Solo para planes con `aiReports` (Profesional y Empresarial) y roles de gestión;
 * el ENCARGADO_SUCURSAL solo obtiene datos de sus sucursales.
 */
@ApiTags('Reportes con IA')
@ApiBearerAuth()
@Controller('ai/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.ENCARGADO, Role.ENCARGADO_SUCURSAL)
@RequiresFeature('aiReports')
export class AiReportsController {
  constructor(private readonly service: AiReportsService) {}

  /** Pregunta en lenguaje natural (texto o voz transcrita) → tabla, gráfico y resumen. */
  @Post('query')
  @HttpCode(200)
  consultar(@Request() req: any, @Body() dto: ConsultaReporteDto) {
    return this.service.consultar(req.user, dto);
  }

  /** Tipos de reporte disponibles (para sugerencias en la pantalla). */
  @Get('herramientas')
  herramientas() {
    return this.service.herramientas();
  }

  /** Últimas consultas (bitácora). */
  @Get('historial')
  historial(@Request() req: any) {
    return this.service.historial(req.user);
  }
}
