import { IsInt, IsPositive } from 'class-validator';

export class CreateVentaCarritoDto {
  @IsInt()
  @IsPositive()
  idSucursal: number;
}