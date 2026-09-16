import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePagoDto {
  @IsInt()
  @IsPositive()
  idVenta: number;

  @IsString()
  @ApiProperty({ enum: ['EFECTIVO', 'TARJETA', 'QR', 'TRANSFERENCIA', 'CONTRAPAGO'] })
  @IsIn(['EFECTIVO', 'TARJETA', 'QR', 'TRANSFERENCIA', 'CONTRAPAGO'])
  metodo: string;

  /** UUID generado por el cliente para permitir reintentos seguros. */
  @ApiPropertyOptional({ format: 'uuid', description: 'UUID generado por el cliente para reintentos seguros' })
  @IsOptional()
  @IsUUID()
  clientRequestId?: string;

  @IsNumber()
  @Min(0.01)
  monto: number;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  referenciaPasarela?: string;
}
