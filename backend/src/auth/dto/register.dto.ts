import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(100)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  apellido?: string;

  @IsEmail({}, { message: 'El email no es válido' })
  @IsNotEmpty({ message: 'El email es obligatorio' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;

  /** Slug de la empresa en cuya tienda se registra el cliente. Si falta: header `X-Tenant` o empresa por defecto. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Matches(/^[a-z0-9-]+$/, { message: 'El identificador de empresa no es válido' })
  empresa?: string;
}