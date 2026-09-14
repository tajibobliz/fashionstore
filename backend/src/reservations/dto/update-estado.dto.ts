import { IsIn, IsString } from 'class-validator';

export class UpdateEstadoReservaDto {
  @IsString()
  @IsIn(['PENDIENTE', 'PREPARADA', 'ATENDIDA', 'CANCELADA'])
  estado: string;
}
