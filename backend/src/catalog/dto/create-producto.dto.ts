import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductoDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  idSucursal?: number;

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
  @Matches(/^$|^https?:\/\/[^?#]+\.(?:jpe?g|png|webp)(?:[?#].*)?$/i, { message: 'imagenUrl debe ser una URL JPG, JPEG, PNG o WebP' })
  imagenUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(/^$|^https?:\/\/[^?#]+\.(?:jpe?g|png|webp)(?:[?#].*)?$/i, { message: 'imagenCatalogoUrl debe ser una URL JPG, JPEG, PNG o WebP' })
  imagenCatalogoUrl?: string;

  @IsOptional()
  @IsString()
  recursoRaUrl?: string;

  /** PNG sin fondo para el vestidor virtual 2D. null o cadena vacía lo quita. */
  @ApiPropertyOptional({ example: 'https://cdn.ejemplo.com/blusa-overlay.webp', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(/^$|^(?:https?:\/\/[^?#]+\.(?:png|webp)(?:[?#].*)?|\/uploads\/tryon\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png)$/i, { message: 'imagenTryOn debe ser PNG o WebP externo, o un PNG local de vestidor' })
  imagenTryOn?: string | null;

  @ApiPropertyOptional({ example: 'https://cdn.ejemplo.com/blusa.png', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(/^$|^(?:https?:\/\/[^?#]+\.(?:png|webp)(?:[?#].*)?|\/uploads\/tryon\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png)$/i, { message: 'imagenVestidorUrl debe ser PNG o WebP externo, o un PNG local de vestidor' })
  imagenVestidorUrl?: string | null;

  /** Tipo de prenda para el vestidor virtual: define qué landmarks usa (cara para lentes/gorra, cuerpo para poleras). null si el producto no tiene vestidor. */
  @ApiPropertyOptional({ enum: ['lentes', 'gorra', 'polera'], nullable: true })
  @IsOptional()
  @IsIn(['lentes', 'gorra', 'polera'])
  tipoTryOn?: 'lentes' | 'gorra' | 'polera' | null;

  @ApiPropertyOptional({ enum: ['GORRA', 'SOMBRERO', 'CAMISA', 'BLUSA', 'TOP', 'PANTALON', 'VESTIDO_CORTO', 'VESTIDO_LARGO', 'FALDA_CORTA', 'FALDA_LARGA', 'COLLAR', 'CARTERA', 'BUFANDA', 'VESTIDO', 'FALDA', 'OTRO'], nullable: true })
  @IsOptional()
  @IsIn(['GORRA', 'SOMBRERO', 'CAMISA', 'BLUSA', 'TOP', 'PANTALON', 'VESTIDO_CORTO', 'VESTIDO_LARGO', 'FALDA_CORTA', 'FALDA_LARGA', 'COLLAR', 'CARTERA', 'BUFANDA', 'VESTIDO', 'FALDA', 'OTRO'])
  tipoPrendaVestidor?: 'GORRA' | 'SOMBRERO' | 'CAMISA' | 'BLUSA' | 'TOP' | 'PANTALON' | 'VESTIDO_CORTO' | 'VESTIDO_LARGO' | 'FALDA_CORTA' | 'FALDA_LARGA' | 'COLLAR' | 'CARTERA' | 'BUFANDA' | 'VESTIDO' | 'FALDA' | 'OTRO' | null;

  @IsOptional()
  @IsBoolean()
  estado?: boolean;
}
