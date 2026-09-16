import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePromocionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  porcentaje: number;

  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @IsOptional()
  @IsBoolean()
  estado?: boolean;

  @IsArray()
  @IsOptional()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  idsProductos?: number[];

  @IsOptional() @IsArray() @IsInt({ each: true }) @IsPositive({ each: true })
  idsCategorias?: number[];

  @IsOptional() @IsArray() @IsInt({ each: true }) @IsPositive({ each: true })
  idsTemporadas?: number[];
}
