import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateSucursalDto {
  @IsInt()
  @IsPositive()
  idCiudad: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  direccion: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;

  @IsOptional()
  @IsBoolean()
  estado?: boolean;
}