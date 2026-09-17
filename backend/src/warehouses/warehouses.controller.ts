import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { WarehousesService } from './warehouses.service';
import { CreateAlmacenDto } from './dto/create-almacen.dto';
import { UpdateAlmacenDto } from './dto/update-almacen.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { BranchAccessService } from '../users/branch-access.service';

@Controller('warehouses') @UseGuards(JwtAuthGuard, RolesGuard)
export class WarehousesController {
  constructor(private readonly service: WarehousesService, private readonly access: BranchAccessService) {}
  @Post() @Roles(Role.ADMIN, Role.ENCARGADO, Role.ENCARGADO_SUCURSAL)
  async create(@Body() dto: CreateAlmacenDto, @Request() req: any) { await this.access.assertCanAccess(req.user, dto.idSucursal); return this.service.create(dto); }
  @Get() @Roles(Role.ADMIN, Role.ENCARGADO, Role.ENCARGADO_SUCURSAL)
  async findAll(@Request() req: any) { return this.service.findAllAuthorized(req.user); }
  @Get('sucursal/:idSucursal') @Roles(Role.ADMIN,Role.ENCARGADO,Role.ENCARGADO_SUCURSAL)
  async byBranch(@Param('idSucursal',ParseIntPipe) id:number,@Request() req:any){await this.access.assertCanAccess(req.user,id);return this.service.findBySucursal(id);}
  @Get(':id') @Roles(Role.ADMIN,Role.ENCARGADO,Role.ENCARGADO_SUCURSAL)
  async one(@Param('id',ParseIntPipe) id:number,@Request() req:any){const item=await this.service.findOne(id);await this.access.assertCanAccess(req.user,item.sucursal.idSucursal);return item;}
  @Patch(':id') @Roles(Role.ADMIN,Role.ENCARGADO) update(@Param('id',ParseIntPipe) id:number,@Body() dto:UpdateAlmacenDto){return this.service.update(id,dto);}
  @Delete(':id') @Roles(Role.ADMIN,Role.ENCARGADO) remove(@Param('id',ParseIntPipe) id:number){return this.service.remove(id);}
}
