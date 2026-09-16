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
    const assignment = await this.assignments.findOne({
      where: { usuario: { idUsuario: actor.idUsuario }, sucursal: { idSucursal }, estado: true },
    });
    if (!assignment || !assignment.sucursal.estado) {
      throw new ForbiddenException('No tienes una asignación activa para esta sucursal');
    }
  }
  isNational(actor: AuthenticatedUser) { return [Role.ADMIN, Role.ENCARGADO].includes(actor.rol); }
  async accessibleBranchIds(actor: AuthenticatedUser) {
    if (this.isNational(actor)) return null;
    const rows = await this.assignments.find({ where: { usuario: { idUsuario: actor.idUsuario }, estado: true } });
    return rows.filter((row) => row.sucursal.estado).map((row) => row.sucursal.idSucursal);
  }
}
