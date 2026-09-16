import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsIn,
  IsOptional,
  IsPositive,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DetalleVentaDto } from './detalle-venta.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVentaPresencialDto {
  @IsOptional()
  @ApiPropertyOptional({ enum: ['MINORISTA', 'MAYORISTA'], default: 'MINORISTA' })
  @IsIn(['MINORISTA', 'MAYORISTA'])
  modalidadComercial?: 'MINORISTA' | 'MAYORISTA';

  /** UUID generado por el dispositivo POS para permitir reintentos seguros. */
  @ApiPropertyOptional({ format: 'uuid', description: 'UUID generado por el dispositivo para reintentos seguros' })
  @IsOptional()
  @IsUUID()
  clientRequestId?: string;
  @IsOptional()
  @IsInt()
  @IsPositive()
  idCaja?: number;

  @IsInt()
  @IsPositive()
  idSucursal: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  idUsuario?: number; // opcional: si el cliente no tiene cuenta

  @IsOptional()
  @IsInt()
  @IsPositive()
  idReserva?: number; // opcional: si viene de una reserva

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DetalleVentaDto)
  detalles: DetalleVentaDto[];
}
