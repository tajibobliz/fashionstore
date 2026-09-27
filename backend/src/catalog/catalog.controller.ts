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
  Query,
  Request,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';
import { CreateTallaDto } from './dto/create-talla.dto';
import { UpdateTallaDto } from './dto/update-talla.dto';
import { CreateColorDto } from './dto/create-color.dto';
import { UpdateColorDto } from './dto/update-color.dto';
import { CreateTemporadaDto } from './dto/create-temporada.dto';
import { UpdateTemporadaDto } from './dto/update-temporada.dto';
import { CreateProveedorDto } from './dto/create-proveedor.dto';
import { UpdateProveedorDto } from './dto/update-proveedor.dto';
import { CreateColeccionDto } from './dto/create-coleccion.dto';
import { UpdateColeccionDto } from './dto/update-coleccion.dto';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';
import { CreateVarianteDto } from './dto/create-variante.dto';
import { UpdateVarianteDto } from './dto/update-variante.dto';
import { CreateImagenVarianteDto } from './dto/create-imagen-variante.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { Public } from '../auth/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { BranchAccessService } from '../users/branch-access.service';

@Controller('catalog')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CatalogController {
  constructor(private readonly service: CatalogService, private readonly access: BranchAccessService) {}

  private async resolveBranchScope(user: any, rawBranchId?: string): Promise<number | null> {
    const requested = rawBranchId === undefined ? undefined : Number(rawBranchId);
    if (requested !== undefined && (!Number.isInteger(requested) || requested <= 0)) {
      throw new BadRequestException('idSucursal debe ser un entero positivo');
    }
    if (!user || user.rol === Role.CLIENTE) return requested ?? null;
    if ([Role.ENCARGADO_SUCURSAL, Role.CAJERO].includes(user.rol)) {
      const ids = await this.access.accessibleBranchIds(user);
      if (!ids?.length) throw new ForbiddenException('No tienes una sucursal activa asignada');
      const idSucursal = requested ?? ids[0];
      await this.access.assertCanAccess(user, idSucursal);
      return idSucursal;
    }
    if ([Role.ADMIN, Role.ENCARGADO].includes(user.rol)) return requested ?? null;
    throw new ForbiddenException('El rol no puede consultar el catálogo de sucursales');
  }

  // ===== CATEGORIAS =====
  @Post('categorias') @Roles(Role.ADMIN, Role.ENCARGADO, Role.ENCARGADO_SUCURSAL)
  async createCategoria(@Body() dto: CreateCategoriaDto, @Request() req: any) { const branchId = await this.writeBranch(req.user, dto.idSucursal); return this.service.createCategoria(dto, branchId); }
  @Public()
  @Get('categorias')
  @UseGuards(OptionalJwtAuthGuard)
  async findAllCategorias(@Query('idSucursal') idSucursal: string | undefined, @Request() req: any) { const branchId = req.user && [Role.ENCARGADO_SUCURSAL, Role.CAJERO].includes(req.user.rol) ? await this.resolveBranchScope(req.user, idSucursal) : null; return this.service.findAllCategorias(branchId ?? undefined); }
  @Public()
  @Get('categorias/:id')
  findOneCategoria(@Param('id', ParseIntPipe) id: number) { return this.service.findOneCategoria(id); }
  @Patch('categorias/:id') @Roles(Role.ADMIN, Role.ENCARGADO)
  updateCategoria(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCategoriaDto) { return this.service.updateCategoria(id, dto); }
  @Delete('categorias/:id') @Roles(Role.ADMIN, Role.ENCARGADO)
  removeCategoria(@Param('id', ParseIntPipe) id: number) { return this.service.removeCategoria(id); }

  // ===== TALLAS =====
  @Post('tallas') @Roles(Role.ADMIN, Role.ENCARGADO, Role.ENCARGADO_SUCURSAL)
  async createTalla(@Body() dto: CreateTallaDto, @Request() req: any) { const branchId = await this.writeBranch(req.user, dto.idSucursal); return this.service.createTalla(dto, branchId); }
  @Public()
  @Get('tallas')
  @UseGuards(OptionalJwtAuthGuard)
  async findAllTallas(@Query('idSucursal') idSucursal: string | undefined, @Request() req: any) { const branchId = req.user && [Role.ENCARGADO_SUCURSAL, Role.CAJERO].includes(req.user.rol) ? await this.resolveBranchScope(req.user, idSucursal) : null; return this.service.findAllTallas(branchId ?? undefined); }
  @Public()
  @Get('tallas/:id')
  findOneTalla(@Param('id', ParseIntPipe) id: number) { return this.service.findOneTalla(id); }
  @Patch('tallas/:id') @Roles(Role.ADMIN, Role.ENCARGADO)
  updateTalla(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTallaDto) { return this.service.updateTalla(id, dto); }
  @Delete('tallas/:id') @Roles(Role.ADMIN, Role.ENCARGADO)
  removeTalla(@Param('id', ParseIntPipe) id: number) { return this.service.removeTalla(id); }

  // ===== COLORES =====
  @Post('colores') @Roles(Role.ADMIN, Role.ENCARGADO, Role.ENCARGADO_SUCURSAL)
  async createColor(@Body() dto: CreateColorDto, @Request() req: any) { const branchId = await this.writeBranch(req.user, dto.idSucursal); return this.service.createColor(dto, branchId); }
  @Public()
  @Get('colores')
  @UseGuards(OptionalJwtAuthGuard)
  async findAllColores(@Query('idSucursal') idSucursal: string | undefined, @Request() req: any) { const branchId = req.user && [Role.ENCARGADO_SUCURSAL, Role.CAJERO].includes(req.user.rol) ? await this.resolveBranchScope(req.user, idSucursal) : null; return this.service.findAllColores(branchId ?? undefined); }
  @Public()
  @Get('colores/:id')
  findOneColor(@Param('id', ParseIntPipe) id: number) { return this.service.findOneColor(id); }
  @Patch('colores/:id') @Roles(Role.ADMIN, Role.ENCARGADO)
  updateColor(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateColorDto) { return this.service.updateColor(id, dto); }
  @Delete('colores/:id') @Roles(Role.ADMIN, Role.ENCARGADO)
  removeColor(@Param('id', ParseIntPipe) id: number) { return this.service.removeColor(id); }

  // ===== TEMPORADAS =====
  @Post('temporadas') @Roles(Role.ADMIN)
  createTemporada(@Body() dto: CreateTemporadaDto) { return this.service.createTemporada(dto); }
  @Public()
  @Get('temporadas')
  findAllTemporadas() { return this.service.findAllTemporadas(); }
  @Public()
  @Get('temporadas/:id')
  findOneTemporada(@Param('id', ParseIntPipe) id: number) { return this.service.findOneTemporada(id); }
  @Patch('temporadas/:id') @Roles(Role.ADMIN)
  updateTemporada(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTemporadaDto) { return this.service.updateTemporada(id, dto); }
  @Delete('temporadas/:id') @Roles(Role.ADMIN)
  removeTemporada(@Param('id', ParseIntPipe) id: number) { return this.service.removeTemporada(id); }

  // ===== PROVEEDORES =====
  @Post('proveedores') @Roles(Role.ADMIN)
  createProveedor(@Body() dto: CreateProveedorDto) { return this.service.createProveedor(dto); }
  @Get('proveedores') @Roles(Role.ADMIN)
  findAllProveedores() { return this.service.findAllProveedores(); }
  @Get('proveedores/:id') @Roles(Role.ADMIN)
  findOneProveedor(@Param('id', ParseIntPipe) id: number) { return this.service.findOneProveedor(id); }
  @Patch('proveedores/:id') @Roles(Role.ADMIN)
  updateProveedor(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProveedorDto) { return this.service.updateProveedor(id, dto); }
  @Delete('proveedores/:id') @Roles(Role.ADMIN)
  removeProveedor(@Param('id', ParseIntPipe) id: number) { return this.service.removeProveedor(id); }

  // ===== COLECCIONES =====
  @Post('colecciones') @Roles(Role.ADMIN)
  createColeccion(@Body() dto: CreateColeccionDto) { return this.service.createColeccion(dto); }
  @Public()
  @Get('colecciones')
  findAllColecciones() { return this.service.findAllColecciones(); }
  @Public()
  @Get('colecciones/:id')
  findOneColeccion(@Param('id', ParseIntPipe) id: number) { return this.service.findOneColeccion(id); }
  @Patch('colecciones/:id') @Roles(Role.ADMIN)
  updateColeccion(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateColeccionDto) { return this.service.updateColeccion(id, dto); }
  @Delete('colecciones/:id') @Roles(Role.ADMIN)
  removeColeccion(@Param('id', ParseIntPipe) id: number) { return this.service.removeColeccion(id); }

  // ===== PRODUCTOS =====
  @Post('productos') @Roles(Role.ADMIN, Role.ENCARGADO, Role.ENCARGADO_SUCURSAL)
  async createProducto(@Body() dto: CreateProductoDto, @Request() req: any) { const branchId = await this.writeBranch(req.user, dto.idSucursal); return this.service.createProducto(dto, branchId); }
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('productos')
  async findAllProductos(@Query('idSucursal') idSucursal: string | undefined, @Request() req: any) {
    const scope = await this.resolveBranchScope(req.user, idSucursal);
    return scope === null ? this.service.findAllProductos() : this.service.findAllProductosByBranch(scope);
  }
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('productos/:id')
  async findOneProducto(@Param('id', ParseIntPipe) id: number, @Query('idSucursal') idSucursal: string | undefined, @Request() req: any) {
    const scope = await this.resolveBranchScope(req.user, idSucursal);
    return scope === null ? this.service.findOneProducto(id) : this.service.findOneProductoByBranch(id, scope);
  }
  @Patch('productos/:id') @Roles(Role.ADMIN, Role.ENCARGADO, Role.ENCARGADO_SUCURSAL)
  async updateProducto(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductoDto, @Request() req: any) { const branchId = await this.writeBranch(req.user, dto.idSucursal); return this.service.updateProducto(id, dto, branchId); }
  @Delete('productos/:id') @Roles(Role.ADMIN, Role.ENCARGADO)
  removeProducto(@Param('id', ParseIntPipe) id: number) { return this.service.removeProducto(id); }

  // ===== VARIANTES =====
  @Post('variantes') @Roles(Role.ADMIN, Role.ENCARGADO, Role.ENCARGADO_SUCURSAL)
  async createVariante(@Body() dto: CreateVarianteDto, @Request() req: any) { const branchId = await this.writeBranch(req.user, dto.idSucursal); return this.service.createVariante(dto, branchId); }
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('variantes')
  async findAllVariantes(@Query('idSucursal') idSucursal: string | undefined, @Request() req: any) {
    const scope = await this.resolveBranchScope(req.user, idSucursal);
    return scope === null ? this.service.findAllVariantes() : this.service.findAllVariantesByBranch(scope);
  }
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('variantes/:id')
  async findOneVariante(@Param('id', ParseIntPipe) id: number, @Query('idSucursal') idSucursal: string | undefined, @Request() req: any) {
    const scope = await this.resolveBranchScope(req.user, idSucursal);
    return scope === null ? this.service.findOneVariante(id) : this.service.findOneVarianteByBranch(id, scope);
  }
  @Patch('variantes/:id') @Roles(Role.ADMIN, Role.ENCARGADO, Role.ENCARGADO_SUCURSAL)
  async updateVariante(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateVarianteDto, @Request() req: any) { const branchId = await this.writeBranch(req.user, dto.idSucursal); return this.service.updateVariante(id, dto, branchId); }
  @Delete('variantes/:id') @Roles(Role.ADMIN, Role.ENCARGADO)
  removeVariante(@Param('id', ParseIntPipe) id: number) { return this.service.removeVariante(id); }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('variantes/:id/imagenes')
  async findImagenesVariante(@Param('id', ParseIntPipe) id: number, @Query('idSucursal') idSucursal: string | undefined, @Request() req: any) {
    const scope = await this.resolveBranchScope(req.user, idSucursal);
    return scope === null ? this.service.findImagenesVariante(id) : this.service.findImagenesVarianteByBranch(id, scope);
  }

  @Post('variantes/:id/imagenes') @Roles(Role.ADMIN, Role.ENCARGADO)
  createImagenVariante(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateImagenVarianteDto) { return this.service.createImagenVariante(id, dto); }

  @Patch('variantes/:id/imagenes/:idImagen/principal') @Roles(Role.ADMIN, Role.ENCARGADO)
  setImagenPrincipal(@Param('id', ParseIntPipe) id: number, @Param('idImagen', ParseIntPipe) idImagen: number) { return this.service.setImagenPrincipal(id, idImagen); }

  @Delete('variantes/:id/imagenes/:idImagen') @Roles(Role.ADMIN, Role.ENCARGADO)
  removeImagenVariante(@Param('id', ParseIntPipe) id: number, @Param('idImagen', ParseIntPipe) idImagen: number) { return this.service.removeImagenVariante(id, idImagen); }

  private async writeBranch(user: any, dtoBranchId?: number): Promise<number | undefined> {
    if (user?.rol !== Role.ENCARGADO_SUCURSAL) return undefined;
    if (!dtoBranchId) throw new BadRequestException('idSucursal es obligatorio para crear datos de catálogo de sucursal');
    await this.access.assertCanAccess(user, dtoBranchId);
    return dtoBranchId;
  }
}
