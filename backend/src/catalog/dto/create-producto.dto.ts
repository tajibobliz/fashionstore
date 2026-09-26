import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
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

  /** PNG sin fondo para el vestidor virtual 2D. null o cadena vacía lo quita. */
  @ApiPropertyOptional({ example: 'https://cdn.ejemplo.com/lentes-tryon.png', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imagenTryOn?: string | null;

  /** Tipo de prenda para el vestidor virtual: define qué landmarks usa (cara para lentes/gorra, cuerpo para poleras). null si el producto no tiene vestidor. */
  @ApiPropertyOptional({ enum: ['lentes', 'gorra', 'polera'], nullable: true })
  @IsOptional()
  @IsIn(['lentes', 'gorra', 'polera'])
  tipoTryOn?: 'lentes' | 'gorra' | 'polera' | null;

  @IsOptional()
  @IsBoolean()
  estado?: boolean;
}
