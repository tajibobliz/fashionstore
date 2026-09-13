import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario } from '../entities/user.entity';
import { Rol } from '../entities/rol.entity';

@Injectable()
export class AdminSeed implements OnModuleInit {
  private readonly logger = new Logger(AdminSeed.name);

  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    @InjectRepository(Rol)
    private readonly rolRepo: Repository<Rol>,
  ) {}

  async onModuleInit() {
    const email = 'admin@fashionstore.com';

    const existe = await this.usuarioRepo.findOne({ where: { email } });
    if (existe) {
      this.logger.log('Admin ya existe, seed omitido.');
      return;
    }

    const rolAdmin = await this.rolRepo.findOne({ where: { nombre: 'ADMIN' } });
    if (!rolAdmin) {
      this.logger.error('Rol ADMIN no encontrado. Asegúrate que RolesSeed corrió antes.');
      return;
    }

    const passwordHash = await bcrypt.hash('admin123', 10);

    const admin = this.usuarioRepo.create({
      nombre: 'Administrador',
      apellido: 'Sistema',
      email,
      passwordHash,
      estado: true,
      rol: rolAdmin,
    });

    await this.usuarioRepo.save(admin);
    this.logger.log(`Admin creado: ${email} / admin123`);
  }
}