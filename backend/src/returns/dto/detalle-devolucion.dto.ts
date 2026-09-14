import { IsInt, IsPositive } from 'class-validator';

export class DetalleDevolucionDto {
  @IsInt()
  @IsPositive()
  idDetalleVenta: number;

  @IsInt()
  @IsPositive()
  cantidad: number;
}