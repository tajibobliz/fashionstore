import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import {
  ResolverConflictoDto,
  SyncCatalogQueryDto,
  SyncOperationsDto,
} from './dto/sync.dto';
import { SyncService } from './sync.service';

const ROLES_EMPRESA = [
  Role.ADMIN,
  Role.ENCARGADO,
  Role.ENCARGADO_SUCURSAL,
  Role.CAJERO,
  Role.CLIENTE,
];
const ROLES_PANEL = [Role.ADMIN, Role.ENCARGADO, Role.ENCARGADO_SUCURSAL];

/**
 * Sincronización offline (Fase 2): la PWA y la app móvil descargan el catálogo,
 * trabajan sin conexión y luego envían sus operaciones pendientes.
 */
@ApiTags('sync')
@ApiBearerAuth()
@Controller('sync')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SyncController {
  constructor(private readonly service: SyncService) {}

  /** Catálogo + stock de una sucursal para guardar en el dispositivo. */
  @Get('catalog')
  @Roles(...ROLES_EMPRESA)
  catalog(@Query() q: SyncCatalogQueryDto) {
    return this.service.catalogo(q.sucursal);
  }

  /** Recibe las ventas y reservas hechas sin conexión. Responde un resultado por operación. */
  @Post('operations')
  @HttpCode(200)
  @Roles(...ROLES_EMPRESA)
  operations(@Request() req: any, @Body() dto: SyncOperationsDto) {
    return this.service.sincronizar(req.user, dto);
  }

  /** Panel: operaciones sincronizadas (?pendientes=true → solo conflictos y rechazos sin revisar). */
  @Get('operaciones')
  @Roles(...ROLES_PANEL)
  listar(@Request() req: any, @Query('pendientes') pendientes?: string) {
    return this.service.listar(req.user, pendientes === 'true');
  }

  @Get('resumen')
  @Roles(...ROLES_PANEL)
  resumen(@Request() req: any) {
    return this.service.resumen(req.user);
  }

  /** El encargado marca un conflicto como revisado, con una nota de lo que hizo. */
  @Patch('operaciones/:id/resolver')
  @Roles(...ROLES_PANEL)
  resolver(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResolverConflictoDto,
  ) {
    return this.service.resolver(req.user, id, dto.nota);
  }
}
