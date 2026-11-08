import { CODIGOS_MONEDA } from '../../common/monedas';
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
  IsUrl,
  NotContains,
  ValidateIf,
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
  /** Moneda en la que venderá la tienda (por defecto BOB). */
  @IsOptional() @IsIn(CODIGOS_MONEDA) moneda?: string;
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
  @IsOptional() @IsObject() features?: {
    aiReports?: boolean;
    ml?: boolean;
    pagosOnline?: boolean;
  };
  @IsOptional() @Type(() => Number) @Min(0) precioReferencia?: number;
  @IsOptional() @IsBoolean() activo?: boolean;
}

/** Solo para simular vencimientos en pruebas y en la defensa. */
export class FechaVencimientoDto {
  @IsISO8601({ strict: true }) fechaVencimiento: string;
}

/** Portada de la tienda online: imagen grande (enlace https) y frase. Vacío = quitar. */
export class PortadaTiendaDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    { message: 'La imagen debe ser un enlace que empiece con https://' },
  )
  @MaxLength(500, { message: 'El enlace es demasiado largo (máx. 500)' })
  portadaUrl?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(160, { message: 'La frase admite hasta 160 caracteres' })
  eslogan?: string | null;
}

export class SesionOfflineDto {
  /** Horas que se puede operar sin conexión desde la última vez en línea (1 hora a 30 días). */
  @IsInt({ message: 'Indica un número entero de horas' })
  @Min(1, { message: 'El mínimo es 1 hora' })
  @Max(720, { message: 'El máximo es 720 horas (30 días)' })
  horasSesionOffline: number;
}

export class MonedaEmpresaDto {
  @IsIn(CODIGOS_MONEDA, { message: 'Moneda no soportada' }) moneda: string;
}
