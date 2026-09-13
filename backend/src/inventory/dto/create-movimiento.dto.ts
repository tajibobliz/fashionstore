import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateMovimientoDto {
  @IsInt()
  @IsPositive()
  idInventario: number;

  @IsString()
  @IsNotEmpty()
  @IsIn([
    'ENTRADA',
    'RESERVA',
    'LIBERACION_RESERVA',
    'VENTA',
    'DEVOLUCION',
    'AJUSTE',
  ])
  tipo: string;

  @IsInt()
  @IsPositive()
  cantidad: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  referencia?: string;
}