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
  Query,
  BadRequestException,
  ForbiddenException,
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
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

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
  @UseGuards(OptionalJwtAuthGuard)
  @Get('inventarios')
  @Roles(Role.ADMIN, Role.ENCARGADO, Role.ENCARGADO_SUCURSAL, Role.CAJERO, Role.CLIENTE)
  async findAllInventarios(@Query('idSucursal') rawBranchId: string | undefined, @Request() req:any) {
    const selectedBranchId = rawBranchId === undefined ? undefined : Number(rawBranchId);
    if (selectedBranchId !== undefined && (!Number.isInteger(selectedBranchId) || selectedBranchId <= 0)) {
      throw new BadRequestException('idSucursal debe ser un entero positivo');
    }

    if (!req.user || req.user.rol === Role.CLIENTE) {
      return selectedBranchId
        ? this.service.findInventariosByBranches([selectedBranchId])
        : this.service.findAllInventarios();
    }

    if ([Role.ENCARGADO_SUCURSAL, Role.CAJERO].includes(req.user.rol)) {
      const ids = await this.access.accessibleBranchIds(req.user);
      if (!ids?.length) return [];
      const branchId = selectedBranchId ?? ids[0];
      await this.access.assertCanAccess(req.user, branchId);
      return this.service.findInventariosByBranches([branchId]);
    }

    if (![Role.ADMIN, Role.ENCARGADO].includes(req.user.rol)) {
      throw new ForbiddenException('El rol no puede consultar inventario de sucursales');
    }
    if (selectedBranchId) return this.service.findInventariosByBranches([selectedBranchId]);
    return this.service.findAllInventarios();
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
