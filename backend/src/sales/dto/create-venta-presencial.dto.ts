import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsPositive,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DetalleVentaDto } from './detalle-venta.dto';

export class CreateVentaPresencialDto {
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