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