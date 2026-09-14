import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsPositive,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DetalleReservaDto } from './detalle-reserva.dto';

export class CreateReservaDto {
  @IsInt()
  @IsPositive()
  idSucursal: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DetalleReservaDto)
  detalles: DetalleReservaDto[];
}