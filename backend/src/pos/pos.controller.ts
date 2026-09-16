import{Body,Controller,Delete,Get,Param,ParseIntPipe,Patch,Post,Query,Request,UseGuards}from'@nestjs/common';import{PosService}from'./pos.service';import{CreateCajaDto}from'./dto/create-caja.dto';import{UpdateCajaDto}from'./dto/update-caja.dto';import{AbrirTurnoDto}from'./dto/abrir-turno.dto';import{CerrarTurnoDto}from'./dto/cerrar-turno.dto';import{JwtAuthGuard}from'../auth/guards/jwt-auth.guard';import{RolesGuard}from'../auth/guards/roles.guard';import{Roles}from'../auth/decorators/roles.decorator';import{Role}from'../auth/enums/role.enum';import{BranchAccessService}from'../users/branch-access.service';
@Controller('pos')@UseGuards(JwtAuthGuard,RolesGuard)
export class PosController{constructor(private service:PosService,private access:BranchAccessService){}
 @Post('cajas')@Roles(Role.ADMIN,Role.ENCARGADO)createCaja(@Body()dto:CreateCajaDto){return this.service.createCaja(dto);}
 @Get('cajas')@Roles(Role.ADMIN,Role.ENCARGADO)findCajas(){return this.service.findCajas();}
 @Get('cajas/sucursal/:idSucursal')@Roles(Role.ADMIN,Role.ENCARGADO,Role.ENCARGADO_SUCURSAL,Role.CAJERO)async cajasSucursal(@Param('idSucursal',ParseIntPipe)id:number,@Request()req:any){await this.access.assertCanAccess(req.user,id);return this.service.findCajasSucursal(id);}
 @Get('cajas/:id')@Roles(Role.ADMIN,Role.ENCARGADO,Role.ENCARGADO_SUCURSAL,Role.CAJERO)async caja(@Param('id',ParseIntPipe)id:number,@Request()req:any){const c=await this.service.findCaja(id);await this.access.assertCanAccess(req.user,c.sucursal.idSucursal);return c;}
 @Patch('cajas/:id')@Roles(Role.ADMIN,Role.ENCARGADO)updateCaja(@Param('id',ParseIntPipe)id:number,@Body()dto:UpdateCajaDto){return this.service.updateCaja(id,dto);}
 @Delete('cajas/:id')@Roles(Role.ADMIN,Role.ENCARGADO)removeCaja(@Param('id',ParseIntPipe)id:number){return this.service.deactivateCaja(id);}
 @Post('turnos/abrir')@Roles(Role.CAJERO,Role.ENCARGADO_SUCURSAL,Role.ENCARGADO,Role.ADMIN)abrir(@Request()req:any,@Body()dto:AbrirTurnoDto){return this.service.abrir(req.user,dto);}
 @Get('turnos/actual')@Roles(Role.CAJERO,Role.ENCARGADO_SUCURSAL,Role.ENCARGADO,Role.ADMIN)actual(@Request()req:any,@Query('idCaja')idCaja?:string){return this.service.actual(req.user,idCaja?Number(idCaja):undefined);}
 @Post('turnos/:id/cerrar')@Roles(Role.CAJERO,Role.ENCARGADO_SUCURSAL,Role.ENCARGADO,Role.ADMIN)cerrar(@Request()req:any,@Param('id',ParseIntPipe)id:number,@Body()dto:CerrarTurnoDto){return this.service.cerrar(req.user,id,dto);}
}
