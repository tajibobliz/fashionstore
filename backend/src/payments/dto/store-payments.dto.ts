import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { MIME_COMPROBANTE, MIME_IMAGEN } from '../archivos';

/** El ADMIN configura cómo cobra su tienda online. */
export class ActualizarConfigPagoDto {
  @IsOptional() @IsBoolean() tarjeta?: boolean;
  @IsOptional() @IsBoolean() qr?: boolean;
  @IsOptional() @IsBoolean() transferencia?: boolean;
  @IsOptional() @IsBoolean() efectivoRetiro?: boolean;
  @IsOptional() @IsBoolean() contraentrega?: boolean;

  @IsOptional() @IsString() @MaxLength(80) banco?: string;
  @IsOptional() @IsString() @MaxLength(120) titular?: string;
  @IsOptional() @IsString() @MaxLength(40) numeroCuenta?: string;
  @IsOptional() @IsString() @MaxLength(40) tipoCuenta?: string;
  @IsOptional() @IsString() @MaxLength(30) documentoTitular?: string;
  @IsOptional() @IsString() @MaxLength(300) instrucciones?: string;
}

export class SubirQrDto {
  /** Imagen en base64 (con o sin prefijo data:). Máximo 600 KB. */
  @IsString() @MaxLength(900_000) archivoBase64: string;
  @IsIn(MIME_IMAGEN) mime: string;
}

export class SubirComprobanteDto {
  /** Imagen o PDF en base64 (con o sin prefijo data:). Máximo 3 MB. */
  @IsString() @MaxLength(4_200_000) archivoBase64: string;
  @IsIn(MIME_COMPROBANTE) mime: string;
  @IsOptional() @IsString() @MaxLength(120) nombre?: string;
}

export class RechazarPagoDto {
  @IsOptional() @IsString() @MaxLength(150) motivo?: string;
}
