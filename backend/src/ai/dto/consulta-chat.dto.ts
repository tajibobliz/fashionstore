import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ConsultaChatDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(500)
  consulta: string;
}