import { Role } from '../enums/role.enum';

export interface AuthenticatedUser {
  idUsuario: number;
  email?: string;
  rol: Role;
}
