import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DetalleDevolucionDto } from './detalle-devolucion.dto';

export class CreateDevolucionDto {
  @IsInt()
  @IsPositive()
  idVenta: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  motivo?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DetalleDevolucionDto)
  detalles: DetalleDevolucionDto[];
}