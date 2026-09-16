import { IsInt, IsOptional, IsPositive, Min } from 'class-validator';

export class CreateInventarioDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  idAlmacen?: number;

  @IsInt()
  @IsPositive()
  idSucursal: number;

  @IsInt()
  @IsPositive()
  idVariante: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stockDisponible?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stockReservado?: number;
}
