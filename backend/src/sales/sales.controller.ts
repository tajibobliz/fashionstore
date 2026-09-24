import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateVentaCarritoDto } from './dto/create-venta-carrito.dto';
import { CreateVentaPresencialDto } from './dto/create-venta-presencial.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { BranchAccessService } from '../users/branch-access.service';

@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesController {
  constructor(private readonly service: SalesService, private readonly access: BranchAccessService) {}

  // Cliente compra desde su carrito (digital)
  @Post('from-cart')
  @Roles(Role.CLIENTE)
  createFromCart(@Request() req: any, @Body() dto: CreateVentaCarritoDto) {
    return this.service.createFromCart(req.user.idUsuario, dto);
  }

  // Cajero registra venta presencial
  @Post('presencial')
  @Roles(Role.CAJERO, Role.ADMIN,Role.ENCARGADO,Role.ENCARGADO_SUCURSAL)
  createPresencial(@Request() req: any, @Body() dto: CreateVentaPresencialDto) {
    return this.service.createPresencial(req.user, dto);
  }

  // Mis ventas (cliente)
  @Get('me')
  findMine(@Request() req: any) {
    return this.service.findByUsuario(req.user.idUsuario);
  }

  // Todas las ventas (admin/encargado)
  @Get()
  @Roles(Role.ADMIN, Role.ENCARGADO,Role.ENCARGADO_SUCURSAL)
  async findAll(@Request()req:any) {
    const ids=await this.access.accessibleBranchIds(req.user);return ids===null?this.service.findAll():this.service.findAllByBranches(ids);
  }

  @Get('turno/:id')
  @Roles(Role.CAJERO)
  findByTurno(@Param('id', ParseIntPipe) idTurno: number, @Request() req: any) {
    return this.service.findByTurnoForCashier(idTurno, req.user.idUsuario);
  }

  @Get('buscar')
  @Roles(Role.CAJERO, Role.ADMIN, Role.ENCARGADO)
  buscar(@Query('cliente') cliente: string, @Request() req: any) { return this.service.buscarPorCliente(cliente ?? '', req.user); }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    const item=await this.service.findOneAuthorized(id, req.user);if([Role.ENCARGADO_SUCURSAL,Role.CAJERO].includes(req.user.rol))await this.access.assertCanAccess(req.user,item.sucursal.idSucursal);return item;
  }

  // Confirmar venta pendiente (después de pago aprobado)
  @Patch(':id/confirmar')
  @Roles(Role.ADMIN, Role.CAJERO)
  confirmar(@Param('id', ParseIntPipe) id: number) {
    return this.service.confirmar(id);
  }

  // Cancelar venta pendiente
  @Patch(':id/cancelar')
  cancelar(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.service.cancelarAuthorized(id, req.user);
  }
}
