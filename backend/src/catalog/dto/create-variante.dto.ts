import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateVarianteDto {
  @IsInt()
  @IsPositive()
  idProducto: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  idTalla?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  idColor?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  sku: string;
}