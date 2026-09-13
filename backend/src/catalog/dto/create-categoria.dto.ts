import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCategoriaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  descripcion?: string;
}