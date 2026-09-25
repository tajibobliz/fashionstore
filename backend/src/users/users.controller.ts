import {
  Controller,
  Body,
  Post,
  Request,
  Get,
  Query,
  Param,
  ParseIntPipe,
  UseGuards,
  Delete,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { AssignBranchDto } from './dto/assign-branch.dto';
import { UpdatePushTokenDto } from './dto/update-push-token.dto';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(Role.ADMIN, Role.ENCARGADO, Role.ENCARGADO_SUCURSAL, Role.CAJERO)
  create(@Body() dto: CreateUserDto, @Request() req: { user: { rol: Role } }) {
    return this.usersService.createByStaff(dto, req.user.rol);
  }

  @Get()
  @Roles(Role.ADMIN, Role.ENCARGADO)
  findAll() {
    return this.usersService.findAll();
  }

  @Get('clientes/buscar')
  @Roles(Role.ADMIN, Role.ENCARGADO, Role.CAJERO)
  findClientes(@Query('q') q?: string) { return this.usersService.findClientes(q); }

  @Get(':id')
  @Roles(Role.ADMIN)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findById(id);
  }

  @Post('me/push-token')
  updatePushToken(@Request() req: { user: AuthenticatedUser }, @Body() dto: UpdatePushTokenDto) {
    return this.usersService.updatePushToken(req.user.idUsuario, dto.token);
  }

  @Post(':id/sucursales')
  @Roles(Role.ADMIN, Role.ENCARGADO)
  assignBranch(@Param('id', ParseIntPipe) id: number, @Body() dto: AssignBranchDto) {
    return this.usersService.assignBranch(id, dto.idSucursal);
  }

  @Get(':id/sucursales')
  @Roles(Role.ADMIN, Role.ENCARGADO)
  listBranches(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.listBranches(id);
  }

  @Delete(':id/sucursales/:idSucursal')
  @Roles(Role.ADMIN, Role.ENCARGADO)
  deactivateBranch(@Param('id', ParseIntPipe) id: number, @Param('idSucursal', ParseIntPipe) idSucursal: number) {
    return this.usersService.deactivateBranch(id, idSucursal);
  }
}
