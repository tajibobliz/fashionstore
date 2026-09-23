import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Body, Post } from '@nestjs/common';
import { ConsultaChatDto } from './dto/consulta-chat.dto';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { Public } from '../auth/decorators/public.decorator';

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiController {
  constructor(private readonly service: AiService) {}

  // Recomendaciones personalizadas para el cliente logueado
  @Get('recomendaciones')
  recomendar(@Request() req: any, @Query('limit') limit?: string) {
    const n = limit ? parseInt(limit, 10) : 8;
    return this.service.recomendarParaUsuario(req.user.idUsuario, n);
  }

  // Productos populares (fallback público, cualquier logueado)
  @Get('populares')
  populares(@Query('limit') limit?: string) {
    const n = limit ? parseInt(limit, 10) : 8;
    return this.service.productosPopulares(n);
  }

  // Productos similares a uno dado
  @Get('similares/:idProducto')
  similares(
    @Param('idProducto', ParseIntPipe) idProducto: number,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? parseInt(limit, 10) : 6;
    return this.service.productosSimilares(idProducto, n);
  }

  // "Clientes que compraron X también compraron..."
  @Get('tambien-compraron/:idProducto')
  tambienCompraron(
    @Param('idProducto', ParseIntPipe) idProducto: number,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? parseInt(limit, 10) : 6;
    return this.service.tambienCompraron(idProducto, n);
  }
  // Recomendaciones por temporada (útil para landing, sin login)
  @Public()
  @Get('recommendations/season')
  recommendationsBySeason(@Query('temporada') temporada: string, @Query('limit') limit?: string) {
    const n = limit ? parseInt(limit, 10) : 10;
    return this.service.recomendarPorTemporada(temporada, n);
  }

  // Recomendaciones según las tallas más frecuentes del cliente logueado
  @Roles(Role.CLIENTE)
  @Get('recommendations/size')
  recommendationsBySize(@Request() req: any, @Query('limit') limit?: string) {
    const n = limit ? parseInt(limit, 10) : 10;
    return this.service.recomendarPorTalla(req.user.idUsuario, n);
  }

  // Asistente virtual con IA (Claude)
  @Post('chat')
  chat(@Request() req: any, @Body() dto: ConsultaChatDto) {
  return this.service.asistenteChat(req.user.idUsuario, dto.consulta);
  }

  // Reporte por voz para admin/encargado (Claude)
@Post('reporte-voz')
@Roles(Role.ADMIN, Role.ENCARGADO)
reporteVoz(@Body() dto: ConsultaChatDto) {
  return this.service.reporteVoz(dto.consulta);
}
}