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
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateInventarioDto } from './dto/create-inventario.dto';
import { UpdateInventarioDto } from './dto/update-inventario.dto';
import { CreateMovimientoDto } from './dto/create-movimiento.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  // ===== INVENTARIOS =====

  @Post('inventarios')
  @Roles(Role.ADMIN, Role.ENCARGADO)
  createInventario(@Body() dto: CreateInventarioDto) {
    return this.service.createInventario(dto);
  }

  @Get('inventarios')
  @Roles(Role.ADMIN, Role.ENCARGADO, Role.CAJERO)
  findAllInventarios() {
    return this.service.findAllInventarios();
  }

  @Get('inventarios/:id')
  @Roles(Role.ADMIN, Role.ENCARGADO, Role.CAJERO)
  findOneInventario(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOneInventario(id);
  }

  @Patch('inventarios/:id')
  @Roles(Role.ADMIN, Role.ENCARGADO)
  updateInventario(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInventarioDto,
  ) {
    return this.service.updateInventario(id, dto);
  }

  @Delete('inventarios/:id')
  @Roles(Role.ADMIN)
  removeInventario(@Param('id', ParseIntPipe) id: number) {
    return this.service.removeInventario(id);
  }

  // ===== MOVIMIENTOS =====

  @Post('movimientos')
  @Roles(Role.ADMIN, Role.ENCARGADO, Role.CAJERO)
  createMovimiento(@Body() dto: CreateMovimientoDto) {
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