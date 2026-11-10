import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CancelarTraspasoDto,
  CreateTraspasoDto,
  ListarTraspasosDto,
  RecibirTraspasoDto,
  StockQueryDto,
} from './dto/transfers.dto';
import { ROLES_TRASPASO, TransfersService } from './transfers.service';

/** Traspasos de inventario entre sucursales (CU14). */
@ApiTags('Traspasos entre sucursales')
@ApiBearerAuth()
@Controller('transfers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ROLES_TRASPASO)
export class TransfersController {
  constructor(private readonly service: TransfersService) {}

  /** Stock disponible de cada prenda en cada sucursal (para elegir qué mover). */
  @Get('stock')
  stock(@Request() req: any, @Query() q: StockQueryDto) {
    return this.service.stock(req.user, q.q);
  }

  @Get('pendientes')
  pendientes(@Request() req: any) {
    return this.service.pendientes(req.user);
  }

  @Get()
  listar(@Request() req: any, @Query() q: ListarTraspasosDto) {
    return this.service.listar(req.user, q.estado);
  }

  @Get(':id')
  uno(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.service.uno(req.user, id);
  }

  /** Envía: descuenta del origen y deja el traspaso EN_TRANSITO. */
  @Post()
  crear(@Request() req: any, @Body() dto: CreateTraspasoDto) {
    return this.service.crear(req.user, dto);
  }

  /** El destino confirma lo que llegó (total, parcial con merma o rechazo). */
  @Post(':id/recibir')
  recibir(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RecibirTraspasoDto,
  ) {
    return this.service.recibir(req.user, id, dto);
  }

  @Post(':id/cancelar')
  cancelar(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelarTraspasoDto,
  ) {
    return this.service.cancelar(req.user, id, dto);
  }
}
