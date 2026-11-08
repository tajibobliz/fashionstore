import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { PaymentsService } from './payments.service';
import { StorePaymentsService } from './store-payments.service';
import { CreatePagoDto } from './dto/create-pago.dto';
import { UpdateEstadoPagoDto } from './dto/update-estado-pago.dto';
import {
  ActualizarConfigPagoDto,
  SubirComprobanteDto,
  SubirQrDto,
} from './dto/store-payments.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import type { MetodoPago } from './entities/pago.entity';

const PERSONAL = [
  Role.ADMIN,
  Role.ENCARGADO,
  Role.ENCARGADO_SUCURSAL,
  Role.CAJERO,
];

/** Envía un archivo guardado en la base (QR o comprobante) sin dejar que el navegador lo reinterprete. */
function enviarArchivo(
  res: Response,
  a: { datos: Buffer; mime: string; nombre?: string | null },
) {
  res.set({
    'Content-Type': a.mime,
    'Content-Length': String(a.datos.length),
    'Cache-Control': 'private, max-age=60',
    'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': `inline; filename="${(a.nombre ?? 'archivo').replace(/[^\w.\- ]/g, '_')}"`,
  });
  res.end(a.datos);
}

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(
    private readonly service: PaymentsService,
    private readonly store: StorePaymentsService,
  ) {}

  // ---------------------------------------------------------------- medios de pago de la tienda

  /** Configuración completa (ADMIN la edita; ENCARGADO la consulta). */
  @Get('config')
  @Roles(Role.ADMIN, Role.ENCARGADO)
  config(@Request() req: any) {
    return this.store.config(req.user);
  }

  @Put('config')
  @Roles(Role.ADMIN)
  actualizarConfig(@Request() req: any, @Body() dto: ActualizarConfigPagoDto) {
    return this.store.actualizarConfig(req.user, dto);
  }

  @Put('config/qr')
  @Roles(Role.ADMIN)
  subirQr(@Request() req: any, @Body() dto: SubirQrDto) {
    return this.store.subirQr(req.user, dto);
  }

  @Delete('config/qr')
  @Roles(Role.ADMIN)
  quitarQr(@Request() req: any) {
    return this.store.quitarQr(req.user);
  }

  /** Imagen del QR de la tienda (la ve la clienta al pagar). */
  @Get('config/qr')
  async qr(@Request() req: any, @Res() res: Response) {
    enviarArchivo(res, {
      ...(await this.store.imagenQr(req.user)),
      nombre: 'qr',
    });
  }

  /** Medios activos y datos de la cuenta, para la pantalla de pago de la clienta. */
  @Get('metodos')
  metodos(@Request() req: any) {
    return this.store.metodos(req.user);
  }

  /** Pagos de la tienda online pendientes de verificar o cobrar. */
  @Get('por-verificar')
  @Roles(...PERSONAL)
  porVerificar(@Request() req: any) {
    return this.store.porVerificar(req.user);
  }

  /** La clienta paga su compra con tarjeta: devuelve la URL de la página de pago. */
  @Post('venta/:idVenta/tarjeta')
  @Roles(Role.CLIENTE)
  pagarConTarjeta(
    @Param('idVenta', ParseIntPipe) idVenta: number,
    @Request() req: any,
  ) {
    return this.store.pagarConTarjeta(req.user, idVenta);
  }

  // ---------------------------------------------------------------- pagos

  /** Registra un pago. Si lo hace la clienta, el medio debe estar activo en su tienda. */
  @Post()
  async create(@Body() dto: CreatePagoDto, @Request() req: any) {
    if (req.user?.rol === Role.CLIENTE)
      await this.store.validarPagoCliente(
        req.user,
        dto.idVenta,
        dto.metodo as MetodoPago,
      );
    return this.service.create(dto, req.user);
  }

  // Aprobar / rechazar: el personal al verificar el comprobante o al cobrar en efectivo.
  @Patch(':id/estado')
  @Roles(...PERSONAL)
  updateEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEstadoPagoDto,
    @Request() req: any,
  ) {
    return this.service.updateEstado(id, dto, req.user);
  }

  @Post(':id/comprobante')
  subirComprobante(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SubirComprobanteDto,
    @Request() req: any,
  ) {
    return this.store.subirComprobante(req.user, id, dto);
  }

  @Get(':id/comprobante')
  async comprobante(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
    @Res() res: Response,
  ) {
    enviarArchivo(res, await this.store.comprobante(req.user, id));
  }

  /** Pantalla de tarjeta simulada (solo sin claves de Stripe o en las pruebas). */
  @Post(':id/simulado/pagar')
  @HttpCode(200)
  @Roles(Role.CLIENTE)
  pagarSimulado(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.store.pagarTarjetaSimulada(req.user, id);
  }

  @Get()
  @Roles(Role.ADMIN, Role.ENCARGADO)
  findAll() {
    return this.service.findAll();
  }

  @Get('venta/:idVenta')
  findByVenta(
    @Param('idVenta', ParseIntPipe) idVenta: number,
    @Request() req: any,
  ) {
    return this.service.findByVentaAuthorized(idVenta, req.user);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.service.findOneAuthorized(id, req.user);
  }
}
