import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  NotContains,
  ValidateNested,
} from 'class-validator';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const PLANES = ['BASICO', 'PROFESIONAL', 'EMPRESARIAL'];

export class AdminEmpresaDto {
  @IsString() @MaxLength(100) nombre: string;
  @IsOptional() @IsString() @MaxLength(100) apellido?: string;
  @IsEmail() email: string;
  @IsString() @MinLength(6) password: string;
}

export class CreateEmpresaDto {
  @IsString() @MaxLength(150) nombre: string;

  /** Identificador en la URL pública: /t/<slug> */
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  @Matches(SLUG, {
    message:
      'El slug solo admite minúsculas, números y guiones (ej. bella-moda)',
  })
  @NotContains('--')
  slug: string;

  @IsOptional() @IsString() @MaxLength(30) nit?: string;
  @IsIn(PLANES) codigoPlan: string;
  /** Duración de la suscripción en meses (simulada). */
  @IsOptional() @IsInt() @Min(1) @Max(36) meses?: number;

  @ValidateNested() @Type(() => AdminEmpresaDto) admin: AdminEmpresaDto;
}

export class CambiarPlanDto {
  @IsIn(PLANES) codigoPlan: string;
  @IsOptional() @IsInt() @Min(1) @Max(36) meses?: number;
}

export class EstadoEmpresaDto {
  @IsIn(['ACTIVA', 'SUSPENDIDA']) estado: 'ACTIVA' | 'SUSPENDIDA';
}

export class UpdatePlanDto {
  @IsOptional() @IsString() @MaxLength(80) nombre?: string;
  /** null = ilimitado */
  @IsOptional() @IsInt() @Min(0) maxSucursales?: number | null;
  @IsOptional() @IsInt() @Min(0) maxUsuarios?: number | null;
  @IsOptional() @IsObject() features?: { aiReports?: boolean; ml?: boolean };
  @IsOptional() @Type(() => Number) @Min(0) precioReferencia?: number;
  @IsOptional() @IsBoolean() activo?: boolean;
}

/** Solo para simular vencimientos en pruebas y en la defensa. */
export class FechaVencimientoDto {
  @IsISO8601({ strict: true }) fechaVencimiento: string;
}
