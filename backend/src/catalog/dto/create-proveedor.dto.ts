import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateProveedorDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  nit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @IsOptional()
  @IsBoolean()
  estado?: boolean;
}