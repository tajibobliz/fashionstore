import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsPositive,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DetalleReservaDto } from './detalle-reserva.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReservaDto {
  /** UUID generado por el cliente para permitir reintentos seguros. */
  @ApiPropertyOptional({ format: 'uuid', description: 'UUID generado por el cliente para reintentos seguros' })
  @IsOptional()
  @IsUUID()
  clientRequestId?: string;
  @IsInt()
  @IsPositive()
  idSucursal: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DetalleReservaDto)
  detalles: DetalleReservaDto[];
}
