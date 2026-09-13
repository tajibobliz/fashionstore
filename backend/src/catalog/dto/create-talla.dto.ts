import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateTallaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  nombre: string;
}