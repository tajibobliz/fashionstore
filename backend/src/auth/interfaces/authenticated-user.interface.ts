import { Role } from '../enums/role.enum';

export interface AuthenticatedUser {
  idUsuario: number;
  email?: string;
  rol: Role;
  /** Empresa (tenant) del usuario. `null` solo para SUPER_ADMIN. */
  idEmpresa: number | null;
}
