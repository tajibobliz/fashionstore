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
import { BranchesService } from './branches.service';
import { CreateCiudadDto } from './dto/create-ciudad.dto';
import { UpdateCiudadDto } from './dto/update-ciudad.dto';
import { CreateSucursalDto } from './dto/create-sucursal.dto';
import { UpdateSucursalDto } from './dto/update-sucursal.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { Public } from '../auth/decorators/public.decorator';

@Controller('branches')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  // ===== CIUDADES =====

  @Post('ciudades')
  @Roles(Role.ADMIN, Role.ENCARGADO)
  createCiudad(@Body() dto: CreateCiudadDto) {
    return this.branchesService.createCiudad(dto);
  }

  @Public()
  @Get('ciudades')
  findAllCiudades() {
    return this.branchesService.findAllCiudades();
  }

  @Public()
  @Get('ciudades/:id')
  findOneCiudad(@Param('id', ParseIntPipe) id: number) {
    return this.branchesService.findOneCiudad(id);
  }

  @Patch('ciudades/:id')
  @Roles(Role.ADMIN)
  updateCiudad(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCiudadDto,
  ) {
    return this.branchesService.updateCiudad(id, dto);
  }

  @Delete('ciudades/:id')
  @Roles(Role.ADMIN)
  removeCiudad(@Param('id', ParseIntPipe) id: number) {
    return this.branchesService.removeCiudad(id);
  }

  // ===== SUCURSALES =====

  @Post('sucursales')
  @Roles(Role.ADMIN, Role.ENCARGADO)
  createSucursal(@Body() dto: CreateSucursalDto) {
    return this.branchesService.createSucursal(dto);
  }

  @Public()
  @Get('sucursales')
  findAllSucursales() {
    return this.branchesService.findAllSucursales();
  }

  @Public()
  @Get('sucursales/:id')
  findOneSucursal(@Param('id', ParseIntPipe) id: number) {
    return this.branchesService.findOneSucursal(id);
  }

  @Patch('sucursales/:id')
  @Roles(Role.ADMIN, Role.ENCARGADO)
  updateSucursal(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSucursalDto,
  ) {
    return this.branchesService.updateSucursal(id, dto);
  }

  @Delete('sucursales/:id')
  @Roles(Role.ADMIN, Role.ENCARGADO)
  removeSucursal(@Param('id', ParseIntPipe) id: number) {
    return this.branchesService.removeSucursal(id);
  }
}
