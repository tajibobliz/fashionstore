import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePagoDto {
  @IsInt()
  @IsPositive()
  idVenta: number;

  @IsString()
  @IsIn(['EFECTIVO', 'TARJETA', 'QR', 'TRANSFERENCIA'])
  metodo: string;

  @IsNumber()
  @Min(0.01)
  monto: number;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  referenciaPasarela?: string;
}