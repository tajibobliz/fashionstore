import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ArService } from './ar.service';
import { RegistrarInteraccionDto } from './dto/registrar-interaccion.dto';
import { AsignarRecursoDto } from './dto/asignar-recurso.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';

@Controller('ar')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ArController {
  constructor(private readonly service: ArService) {}

  // Catálogo de productos con RA (para el cliente)
  @Get('productos')
  getProductosConRA() {
    return this.service.getProductosConRA();
  }

  // Asignar recurso RA a un producto (solo ADMIN)
  @Post('recurso')
  @Roles(Role.ADMIN)
  asignarRecurso(@Body() dto: AsignarRecursoDto) {
    return this.service.asignarRecurso(dto);
  }

  // Eliminar recurso RA de un producto (solo ADMIN)
  @Delete('recurso/:idProducto')
  @Roles(Role.ADMIN)
  eliminarRecurso(@Param('idProducto', ParseIntPipe) idProducto: number) {
    return this.service.eliminarRecurso(idProducto);
  }

  // El cliente registra que probó un producto (o interactuó de algún modo)
  @Post('interaccion')
  registrarInteraccion(
    @Request() req: any,
    @Body() dto: RegistrarInteraccionDto,
  ) {
    return this.service.registrarInteraccion(req.user.idUsuario, dto);
  }

  // Historial de pruebas virtuales del cliente logueado
  @Get('mis-pruebas')
  getMisPruebas(@Request() req: any) {
    return this.service.getMisPruebasVirtuales(req.user.idUsuario);
  }

  // Top de productos más probados virtualmente (admin/encargado)
  @Get('top-pruebas')
  @Roles(Role.ADMIN, Role.ENCARGADO)
  getTopPruebas(@Query('limit') limit: string) {
    const n = limit ? parseInt(limit, 10) : 10;
    return this.service.getTopPruebasVirtuales(n);
  }
}