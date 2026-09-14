import { IsInt, IsPositive } from 'class-validator';

export class DetalleReservaDto {
  @IsInt()
  @IsPositive()
  idVariante: number;

  @IsInt()
  @IsPositive()
  cantidad: number;
}