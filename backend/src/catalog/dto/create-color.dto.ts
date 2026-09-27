import { IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class CreateColorDto {
  @IsOptional() @IsInt() @IsPositive()
  idSucursal?: number;
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  codigoHex?: string;
}
