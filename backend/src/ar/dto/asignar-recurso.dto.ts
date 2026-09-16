import { IsInt, IsPositive, IsString, IsUrl, MaxLength } from 'class-validator';

export class AsignarRecursoDto {
  @IsInt()
  @IsPositive()
  idProducto: number;

  @IsString()
  @IsUrl()
  @MaxLength(500)
  recursoRaUrl: string;
}