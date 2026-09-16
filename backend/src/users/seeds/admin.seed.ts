import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario } from '../entities/user.entity';
import { Rol } from '../entities/rol.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminSeed implements OnModuleInit {
  private readonly logger = new Logger(AdminSeed.name);

  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    @InjectRepository(Rol)
    private readonly rolRepo: Repository<Rol>,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    const email = this.config.get<string>('ADMIN_EMAIL');
    const password = this.config.get<string>('ADMIN_PASSWORD');
    if (!email || !password) {
      this.logger.warn('Seed de administrador omitido: configura ADMIN_EMAIL y ADMIN_PASSWORD.');
      return;
    }

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

    const passwordHash = await bcrypt.hash(password, 10);

    const admin = this.usuarioRepo.create({
      nombre: this.config.get<string>('ADMIN_NAME') || 'Administrador',
      apellido: this.config.get<string>('ADMIN_LAST_NAME') || 'Sistema',
      email,
      passwordHash,
      estado: true,
      rol: rolAdmin,
    });

    await this.usuarioRepo.save(admin);
    this.logger.log(`Administrador creado: ${email}`);
  }
}
