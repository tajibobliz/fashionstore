import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Ciudad } from '../entities/ciudad.entity';
import { Sucursal } from '../entities/sucursal.entity';
import { Almacen } from '../../warehouses/entities/almacen.entity';
import { Caja } from '../../pos/entities/caja.entity';
import { Rol } from '../../users/entities/rol.entity';
import { Usuario } from '../../users/entities/user.entity';
import { UsuarioSucursal } from '../../users/entities/usuario-sucursal.entity';
import { CatalogMasterSeed } from '../../catalog/seeds/catalog-master.seed';
import { RolesSeed } from '../../users/seeds/roles.seed';

const SUCURSALES = [
  { ciudad: 'La Paz', nombre: 'FashionStore Sopocachi', direccion: 'Av. 20 de Octubre 2450, Sopocachi', telefono: '+591 2 241 7830' },
  { ciudad: 'Santa Cruz de la Sierra', nombre: 'FashionStore Equipetrol', direccion: 'Av. San Martín, Centro Empresarial Equipetrol, local 12', telefono: '+591 3 341 5260' },
  { ciudad: 'Cochabamba', nombre: 'FashionStore Cala Cala', direccion: 'Av. América esquina Pando, Cala Cala', telefono: '+591 4 452 8910' },
  { ciudad: 'Sucre', nombre: 'FashionStore Centro Sucre', direccion: 'Calle Junín 318, zona central', telefono: '+591 4 645 2180' },
];

const CLIENTES = [
  { nombre: 'Valeria', apellido: 'Rojas Mendoza', email: 'valeria.rojas@example.com', telefono: '+591 701 284 516' },
  { nombre: 'Camila', apellido: 'Fernández López', email: 'camila.fernandez@example.com', telefono: '+591 712 395 624' },
  { nombre: 'Lucía', apellido: 'Mamani Flores', email: 'lucia.mamani@example.com', telefono: '+591 720 486 735' },
  { nombre: 'Daniela', apellido: 'Rivero Suárez', email: 'daniela.rivero@example.com', telefono: '+591 773 592 846' },
];

@Injectable()
export class DemoCommerceSeed implements OnModuleInit {
  private readonly logger = new Logger(DemoCommerceSeed.name);
  constructor(
    @InjectRepository(Ciudad) private readonly ciudades: Repository<Ciudad>,
    @InjectRepository(Sucursal) private readonly sucursales: Repository<Sucursal>,
    @InjectRepository(Almacen) private readonly almacenes: Repository<Almacen>,
    @InjectRepository(Caja) private readonly cajas: Repository<Caja>,
    @InjectRepository(Rol) private readonly roles: Repository<Rol>,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(UsuarioSucursal) private readonly asignaciones: Repository<UsuarioSucursal>,
    private readonly config: ConfigService,
    private readonly catalogMasterSeed: CatalogMasterSeed,
    private readonly rolesSeed: RolesSeed,
  ) {}

  async onModuleInit() {
    await this.rolesSeed.onModuleInit();
    await this.catalogMasterSeed.onModuleInit();
    const branches: Sucursal[] = [];
    for (const item of SUCURSALES) {
      let ciudad = await this.ciudades.findOne({ where: { nombre: item.ciudad } });
      if (!ciudad) ciudad = await this.ciudades.save(this.ciudades.create({ nombre: item.ciudad }));
      let branch = await this.sucursales.findOne({ where: { ciudad: { idCiudad: ciudad.idCiudad }, nombre: item.nombre } });
      if (!branch) branch = await this.sucursales.save(this.sucursales.create({ ciudad, nombre: item.nombre, direccion: item.direccion, telefono: item.telefono, estado: true }));
      else if (!branch.estado) { branch.estado = true; branch.direccion = item.direccion; branch.telefono = item.telefono; await this.sucursales.save(branch); }
      branches.push(branch);

      let warehouse = await this.almacenes.findOne({ where: { sucursal: { idSucursal: branch.idSucursal }, codigo: 'PRINCIPAL' } });
      if (!warehouse) warehouse = await this.almacenes.save(this.almacenes.create({ sucursal: branch, codigo: 'PRINCIPAL', nombre: `Almacén Principal - ${branch.nombre}`, estado: true }));
      else if (!warehouse.estado) { warehouse.estado = true; await this.almacenes.save(warehouse); }

      const till = await this.cajas.findOne({ where: { sucursal: { idSucursal: branch.idSucursal }, codigo: 'CAJA-01' } });
      if (!till) await this.cajas.save(this.cajas.create({ sucursal: branch, almacenDefault: warehouse, codigo: 'CAJA-01', nombre: `Caja principal - ${branch.nombre}`, estado: true }));
      else if (till.almacenDefault?.idAlmacen !== warehouse.idAlmacen) { till.almacenDefault = warehouse; await this.cajas.save(till); }
    }

    const nationalEmail = this.config.get<string>('NATIONAL_MANAGER_EMAIL');
    const nationalPassword = this.config.get<string>('NATIONAL_MANAGER_PASSWORD');
    if (nationalEmail && nationalPassword) {
      await this.ensureStaff({ nombre: 'María Fernanda', apellido: 'Vargas Quiroga', email: nationalEmail, telefono: '+591 700 418 285' }, nationalPassword, 'ENCARGADO');
    } else this.logger.warn('Encargada nacional omitida: configura NATIONAL_MANAGER_EMAIL y NATIONAL_MANAGER_PASSWORD.');

    const branchEmail = this.config.get<string>('BRANCH_MANAGER_EMAIL');
    const branchPassword = this.config.get<string>('BRANCH_MANAGER_PASSWORD');
    if (branchEmail && branchPassword) {
      const staff = await this.ensureStaff({ nombre: 'Andrea', apellido: 'Paredes Rocha', email: branchEmail, telefono: '+591 725 418 963' }, branchPassword, 'ENCARGADO_SUCURSAL');
      if (!staff) return;
      const assignment = await this.asignaciones.findOne({ where: { usuario: { idUsuario: staff.idUsuario }, sucursal: { idSucursal: branches[0].idSucursal } } });
      if (assignment) { if (!assignment.estado) { assignment.estado = true; await this.asignaciones.save(assignment); } }
      else await this.asignaciones.save(this.asignaciones.create({ usuario: staff, sucursal: branches[0], estado: true }));
    } else this.logger.warn('Encargado de sucursal omitido: configura BRANCH_MANAGER_EMAIL y BRANCH_MANAGER_PASSWORD.');

    const clientPassword = this.config.get<string>('DEMO_CLIENT_PASSWORD');
    if (!clientPassword) { this.logger.warn('Clientes demo omitidos: configura DEMO_CLIENT_PASSWORD.'); return; }
    for (const client of CLIENTES) {
      const existing = await this.usuarios.findOne({ where: { email: client.email } });
      if (existing) continue;
      const role = await this.roles.findOne({ where: { nombre: 'CLIENTE' } });
      if (!role) { this.logger.error('Rol CLIENTE no encontrado; no se crearon clientes demo.'); return; }
      await this.usuarios.save(this.usuarios.create({ ...client, passwordHash: await bcrypt.hash(clientPassword, 10), estado: true, rol: role }));
    }
    this.logger.log('Sucursales, almacenes y cajas demo verificados; clientes globales verificados.');
  }

  private async ensureStaff(data: { nombre: string; apellido: string; email: string; telefono: string }, password: string, roleName: string) {
    let user = await this.usuarios.findOne({ where: { email: data.email } });
    if (user) return user;
    const role = await this.roles.findOne({ where: { nombre: roleName } });
    if (!role) { this.logger.error(`Rol ${roleName} no encontrado; se omite ${data.email}.`); return null; }
    user = await this.usuarios.save(this.usuarios.create({ ...data, passwordHash: await bcrypt.hash(password, 10), estado: true, rol: role }));
    return user;
  }
}
