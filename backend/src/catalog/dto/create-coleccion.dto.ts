import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateColeccionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  idTemporada?: number;
}