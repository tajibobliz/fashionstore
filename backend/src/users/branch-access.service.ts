import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsuarioSucursal } from './entities/usuario-sucursal.entity';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Role } from '../auth/enums/role.enum';

@Injectable()
export class BranchAccessService {
  constructor(@InjectRepository(UsuarioSucursal) private readonly assignments: Repository<UsuarioSucursal>) {}

  async assertCanAccess(actor: AuthenticatedUser, idSucursal: number) {
    if ([Role.ADMIN, Role.ENCARGADO].includes(actor.rol)) return;
    if (![Role.ENCARGADO_SUCURSAL, Role.CAJERO].includes(actor.rol)) {
      throw new ForbiddenException('El rol no tiene acceso operativo a sucursales');
    }
    const assignments = await this.assignments.find({
      where: { usuario: { idUsuario: actor.idUsuario }, estado: true },
    });
    const activeAssignment = assignments
      .filter((row) => row.sucursal.estado)
      .sort((a, b) => a.idUsuarioSucursal - b.idUsuarioSucursal)[0];
    if (!activeAssignment || activeAssignment.sucursal.idSucursal !== idSucursal) {
      throw new ForbiddenException('No tienes una asignación activa para esta sucursal');
    }
  }
  isNational(actor: AuthenticatedUser) { return [Role.ADMIN, Role.ENCARGADO].includes(actor.rol); }
  async accessibleBranchIds(actor: AuthenticatedUser) {
    if (this.isNational(actor)) return null;
    const rows = await this.assignments.find({ where: { usuario: { idUsuario: actor.idUsuario }, estado: true } });
    const active = rows
      .filter((row) => row.sucursal.estado)
      .sort((a, b) => a.idUsuarioSucursal - b.idUsuarioSucursal);
    return active.length ? [active[0].sucursal.idSucursal] : [];
  }
}
