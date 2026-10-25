import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { SubscriptionsService } from './subscriptions.service';
import {
  CambiarPlanDto,
  CreateEmpresaDto,
  EstadoEmpresaDto,
  FechaVencimientoDto,
  UpdatePlanDto,
} from './dto/platform.dto';

/** Administración de la plataforma SaaS. Solo SUPER_ADMIN. */
@ApiTags('Plataforma SaaS')
@ApiBearerAuth()
@Controller('platform')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class PlatformController {
  constructor(private readonly service: SubscriptionsService) {}

  @Get('planes')
  planes() {
    return this.service.listarPlanes();
  }

  /** Los límites y funcionalidades son configurables (enunciado §9.4). */
  @Patch('planes/:id')
  actualizarPlan(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.service.actualizarPlan(id, dto);
  }

  @Get('empresas')
  empresas() {
    return this.service.listarEmpresas();
  }

  @Post('empresas')
  crearEmpresa(@Body() dto: CreateEmpresaDto) {
    return this.service.crearEmpresa(dto);
  }

  @Get('empresas/:id')
  empresa(@Param('id', ParseIntPipe) id: number) {
    return this.service.resumen(id);
  }

  @Get('empresas/:id/suscripciones')
  historial(@Param('id', ParseIntPipe) id: number) {
    return this.service.historial(id);
  }

  @Patch('empresas/:id/estado')
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EstadoEmpresaDto,
  ) {
    return this.service.cambiarEstado(id, dto.estado);
  }

  /** Asignar, cambiar o renovar el plan. */
  @Post('empresas/:id/suscripcion')
  cambiarPlan(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarPlanDto,
  ) {
    return this.service.cambiarPlan(id, dto.codigoPlan, dto.meses);
  }

  /** Simula un vencimiento (pruebas / defensa). */
  @Patch('empresas/:id/suscripcion/vencimiento')
  fijarVencimiento(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: FechaVencimientoDto,
  ) {
    return this.service.fijarVencimiento(id, dto.fechaVencimiento);
  }
}
