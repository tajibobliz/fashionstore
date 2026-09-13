import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateColorDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  codigoHex?: string;
}