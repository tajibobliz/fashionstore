import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
  Request,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateInventarioDto } from './dto/create-inventario.dto';
import { UpdateInventarioDto } from './dto/update-inventario.dto';
import { CreateMovimientoDto } from './dto/create-movimiento.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { BranchAccessService } from '../users/branch-access.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly service: InventoryService, private readonly access: BranchAccessService) {}

  // ===== INVENTARIOS =====

  @Post('inventarios')
  @Roles(Role.ADMIN, Role.ENCARGADO, Role.ENCARGADO_SUCURSAL)
  async createInventario(@Body() dto: CreateInventarioDto, @Request() req:any) {
    await this.access.assertCanAccess(req.user,dto.idSucursal);
    return this.service.createInventario(dto);
  }

  @Public()
  @Get('inventarios')
  @Roles(Role.ADMIN, Role.ENCARGADO, Role.ENCARGADO_SUCURSAL, Role.CAJERO, Role.CLIENTE)
  async findAllInventarios(@Request() req:any) {
    // CLIENTE elige una sucursal en ecommerce; no tiene asignación laboral.
    // El frontend usa esta lectura para mostrar únicamente la existencia de la sucursal elegida.
    // @Public(): un invitado sin sesión llega aquí con req.user undefined, mismo caso que CLIENTE.
    if (!req.user || req.user.rol === Role.CLIENTE) return this.service.findAllInventarios();
    const ids=await this.access.accessibleBranchIds(req.user);
    return ids===null?this.service.findAllInventarios():this.service.findInventariosByBranches(ids);
  }

  @Get('inventarios/:id')
  @Roles(Role.ADMIN, Role.ENCARGADO, Role.CAJERO)
  async findOneInventario(@Param('id', ParseIntPipe) id: number,@Request()req:any) {
    const item=await this.service.findOneInventario(id);await this.access.assertCanAccess(req.user,item.sucursal.idSucursal);return item;
  }

  @Patch('inventarios/:id')
  @Roles(Role.ADMIN, Role.ENCARGADO,Role.ENCARGADO_SUCURSAL)
  async updateInventario(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInventarioDto,
    @Request()req:any,
  ) {
    const current=await this.service.findOneInventario(id);await this.access.assertCanAccess(req.user,dto.idSucursal??current.sucursal.idSucursal);
    return this.service.updateInventario(id, dto);
  }

  @Delete('inventarios/:id')
  @Roles(Role.ADMIN)
  removeInventario(@Param('id', ParseIntPipe) id: number) {
    return this.service.removeInventario(id);
  }

  // ===== MOVIMIENTOS =====

  @Post('movimientos')
  @Roles(Role.ADMIN, Role.ENCARGADO, Role.ENCARGADO_SUCURSAL)
  async createMovimiento(@Body() dto: CreateMovimientoDto,@Request()req:any) {
    const inv=await this.service.findOneInventario(dto.idInventario);await this.access.assertCanAccess(req.user,inv.sucursal.idSucursal);
    return this.service.createMovimiento(dto);
  }

  @Get('movimientos')
  @Roles(Role.ADMIN, Role.ENCARGADO)
  findAllMovimientos() {
    return this.service.findAllMovimientos();
  }

  @Get('movimientos/:id')
  @Roles(Role.ADMIN, Role.ENCARGADO)
  findOneMovimiento(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOneMovimiento(id);
  }
}
