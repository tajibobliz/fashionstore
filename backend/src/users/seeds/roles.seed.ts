import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rol } from '../entities/rol.entity';

@Injectable()
export class RolesSeed implements OnModuleInit {
  private readonly logger = new Logger(RolesSeed.name);

  constructor(
    @InjectRepository(Rol)
    private readonly rolRepo: Repository<Rol>,
  ) {}

  async onModuleInit() {
    const roles = [
      { nombre: 'CLIENTE', descripcion: 'Cliente final que compra productos' },
      { nombre: 'ADMIN', descripcion: 'Administrador del sistema' },
      { nombre: 'ENCARGADO', descripcion: 'Encargado nacional con acceso a todas las sucursales' },
      { nombre: 'ENCARGADO_SUCURSAL', descripcion: 'Encargado limitado a sucursales asignadas' },
      { nombre: 'CAJERO', descripcion: 'Cajero de punto de venta' },
      { nombre: 'PROVEEDOR', descripcion: 'Proveedor de productos' },
    ];

    for (const role of roles) {
      const existente = await this.rolRepo.findOne({ where: { nombre: role.nombre } });
      if (!existente) await this.rolRepo.save(this.rolRepo.create(role));
      else if (existente.descripcion !== role.descripcion) {
        existente.descripcion = role.descripcion;
        await this.rolRepo.save(existente);
      }
    }
    this.logger.log('Roles verificados correctamente.');
  }
}
