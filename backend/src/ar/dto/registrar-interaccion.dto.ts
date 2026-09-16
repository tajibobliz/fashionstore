import { IsIn, IsInt, IsPositive, IsString } from 'class-validator';

export class RegistrarInteraccionDto {
  @IsInt()
  @IsPositive()
  idProducto: number;

  @IsString()
  @IsIn(['VISUALIZACION', 'BUSQUEDA', 'RESERVA', 'COMPRA', 'PRUEBA_VIRTUAL'])
  tipo: string;
}