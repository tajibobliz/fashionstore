import { IsBoolean } from 'class-validator';

/** Activar (true) o desactivar (false) a un usuario de la empresa. */
export class CambiarEstadoUsuarioDto {
  @IsBoolean({ message: 'estado debe ser true o false' })
  estado: boolean;
}
