import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateCiudadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;
}