import { IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class CreateTallaDto {
  @IsOptional() @IsInt() @IsPositive()
  idSucursal?: number;
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  nombre: string;
}
