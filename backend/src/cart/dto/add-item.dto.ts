import { IsInt, IsPositive } from 'class-validator';

export class AddItemDto {
  @IsInt()
  @IsPositive()
  idSucursal: number;

  @IsInt()
  @IsPositive()
  idVariante: number;

  @IsInt()
  @IsPositive()
  cantidad: number;
}
