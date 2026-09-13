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
    const count = await this.rolRepo.count();

    if (count > 0) {
      this.logger.log('Roles ya existen, seed omitido.');
      return;
    }

    const roles = [
      { nombre: 'CLIENTE', descripcion: 'Cliente final que compra productos' },
      { nombre: 'ADMIN', descripcion: 'Administrador del sistema' },
      { nombre: 'ENCARGADO', descripcion: 'Encargado de sucursal' },
      { nombre: 'CAJERO', descripcion: 'Cajero de punto de venta' },
      { nombre: 'PROVEEDOR', descripcion: 'Proveedor de productos' },
    ];

    await this.rolRepo.save(roles);
    this.logger.log(`${roles.length} roles insertados correctamente.`);
  }
}