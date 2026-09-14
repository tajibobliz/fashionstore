import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateEstadoPagoDto {
  @IsString()
  @IsIn(['APROBADO', 'RECHAZADO', 'ANULADO'])
  estado: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  referenciaPasarela?: string;
}