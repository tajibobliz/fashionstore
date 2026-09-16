import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductoDto {
  @IsInt()
  @IsPositive()
  idCategoria: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  idProveedor?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  idColeccion?: number;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsNumber()
  @Min(0)
  precio: number;

  /** Precio único aplicable a ventas MAYORISTA. */
  @ApiPropertyOptional({ example: 120, minimum: 0, nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  precioMayorista?: number;

  /** Cantidad mínima del producto requerida para venta MAYORISTA. */
  @ApiPropertyOptional({ example: 12, minimum: 1, nullable: true })
  @IsOptional()
  @IsInt()
  @IsPositive()
  cantidadMinimaMayorista?: number;

  @IsOptional()
  @IsString()
  imagenUrl?: string;

  @IsOptional()
  @IsString()
  recursoRaUrl?: string;

  @IsOptional()
  @IsBoolean()
  estado?: boolean;
}
