import { IsInt, IsPositive } from 'class-validator';

export class DetalleVentaDto {
  @IsInt()
  @IsPositive()
  idVariante: number;

  @IsInt()
  @IsPositive()
  cantidad: number;
}