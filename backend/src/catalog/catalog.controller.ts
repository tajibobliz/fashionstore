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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { Public } from '../auth/decorators/public.decorator';

@Controller('catalog')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CatalogController {
  constructor(private readonly service: CatalogService) {}

  // ===== CATEGORIAS =====
  @Post('categorias') @Roles(Role.ADMIN, Role.ENCARGADO, Role.ENCARGADO_SUCURSAL)
  createCategoria(@Body() dto: CreateCategoriaDto) { return this.service.createCategoria(dto); }
  @Public()
  @Get('categorias')
  findAllCategorias() { return this.service.findAllCategorias(); }
  @Public()
  @Get('categorias/:id')
  findOneCategoria(@Param('id', ParseIntPipe) id: number) { return this.service.findOneCategoria(id); }
  @Patch('categorias/:id') @Roles(Role.ADMIN, Role.ENCARGADO, Role.ENCARGADO_SUCURSAL)
  updateCategoria(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCategoriaDto) { return this.service.updateCategoria(id, dto); }
  @Delete('categorias/:id') @Roles(Role.ADMIN, Role.ENCARGADO, Role.ENCARGADO_SUCURSAL)
  removeCategoria(@Param('id', ParseIntPipe) id: number) { return this.service.removeCategoria(id); }

  // ===== TALLAS =====
  @Post('tallas') @Roles(Role.ADMIN, Role.ENCARGADO, Role.ENCARGADO_SUCURSAL)
  createTalla(@Body() dto: CreateTallaDto) { return this.service.createTalla(dto); }
  @Public()
  @Get('tallas')
  findAllTallas() { return this.service.findAllTallas(); }
  @Public()
  @Get('tallas/:id')
  findOneTalla(@Param('id', ParseIntPipe) id: number) { return this.service.findOneTalla(id); }
  @Patch('tallas/:id') @Roles(Role.ADMIN, Role.ENCARGADO, Role.ENCARGADO_SUCURSAL)
  updateTalla(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTallaDto) { return this.service.updateTalla(id, dto); }
  @Delete('tallas/:id') @Roles(Role.ADMIN, Role.ENCARGADO, Role.ENCARGADO_SUCURSAL)
  removeTalla(@Param('id', ParseIntPipe) id: number) { return this.service.removeTalla(id); }

  // ===== COLORES =====
  @Post('colores') @Roles(Role.ADMIN, Role.ENCARGADO, Role.ENCARGADO_SUCURSAL)
  createColor(@Body() dto: CreateColorDto) { return this.service.createColor(dto); }
  @Public()
  @Get('colores')
  findAllColores() { return this.service.findAllColores(); }
  @Public()
  @Get('colores/:id')
  findOneColor(@Param('id', ParseIntPipe) id: number) { return this.service.findOneColor(id); }
  @Patch('colores/:id') @Roles(Role.ADMIN, Role.ENCARGADO, Role.ENCARGADO_SUCURSAL)
  updateColor(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateColorDto) { return this.service.updateColor(id, dto); }
  @Delete('colores/:id') @Roles(Role.ADMIN, Role.ENCARGADO, Role.ENCARGADO_SUCURSAL)
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
  createProducto(@Body() dto: CreateProductoDto) { return this.service.createProducto(dto); }
  @Public()
  @Get('productos')
  findAllProductos() { return this.service.findAllProductos(); }
  @Public()
  @Get('productos/:id')
  findOneProducto(@Param('id', ParseIntPipe) id: number) { return this.service.findOneProducto(id); }
  @Patch('productos/:id') @Roles(Role.ADMIN, Role.ENCARGADO, Role.ENCARGADO_SUCURSAL)
  updateProducto(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductoDto) { return this.service.updateProducto(id, dto); }
  @Delete('productos/:id') @Roles(Role.ADMIN, Role.ENCARGADO, Role.ENCARGADO_SUCURSAL)
  removeProducto(@Param('id', ParseIntPipe) id: number) { return this.service.removeProducto(id); }

  // ===== VARIANTES =====
  @Post('variantes') @Roles(Role.ADMIN, Role.ENCARGADO, Role.ENCARGADO_SUCURSAL)
  createVariante(@Body() dto: CreateVarianteDto) { return this.service.createVariante(dto); }
  @Public()
  @Get('variantes')
  findAllVariantes() { return this.service.findAllVariantes(); }
  @Public()
  @Get('variantes/:id')
  findOneVariante(@Param('id', ParseIntPipe) id: number) { return this.service.findOneVariante(id); }
  @Patch('variantes/:id') @Roles(Role.ADMIN, Role.ENCARGADO, Role.ENCARGADO_SUCURSAL)
  updateVariante(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateVarianteDto) { return this.service.updateVariante(id, dto); }
  @Delete('variantes/:id') @Roles(Role.ADMIN, Role.ENCARGADO, Role.ENCARGADO_SUCURSAL)
  removeVariante(@Param('id', ParseIntPipe) id: number) { return this.service.removeVariante(id); }
}
