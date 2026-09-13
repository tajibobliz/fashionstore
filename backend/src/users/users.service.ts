import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario } from './entities/user.entity';
import { Rol } from './entities/rol.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    @InjectRepository(Rol)
    private readonly rolRepo: Repository<Rol>,
  ) {}

  // Busca un usuario por email (usado para login)
  async findByEmail(email: string): Promise<Usuario | null> {
    return this.usuarioRepo.findOne({ where: { email } });
  }

  // Busca un usuario por id
  async findById(id: number): Promise<Usuario> {
    const user = await this.usuarioRepo.findOne({ where: { idUsuario: id } });
    if (!user) throw new NotFoundException(`Usuario ${id} no encontrado`);
    return user;
  }

  // Crea un nuevo usuario con contraseña encriptada
  async create(data: {
    nombre: string;
    apellido?: string;
    email: string;
    password: string;
    telefono?: string;
    rolNombre?: string;
  }): Promise<Usuario> {
    // Verificar que el email no exista
    const existe = await this.findByEmail(data.email);
    if (existe) throw new ConflictException('El email ya está registrado');

    // Buscar el rol (por defecto CLIENTE)
    const rolNombre = data.rolNombre || 'CLIENTE';
    const rol = await this.rolRepo.findOne({ where: { nombre: rolNombre } });
    if (!rol) throw new NotFoundException(`Rol ${rolNombre} no encontrado`);

    // Encriptar la contraseña
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Crear el usuario
    const nuevo = this.usuarioRepo.create({
      nombre: data.nombre,
      apellido: data.apellido,
      email: data.email,
      passwordHash,
      telefono: data.telefono,
      rol,
    });

    return this.usuarioRepo.save(nuevo);
  }

  // Devuelve todos los usuarios (para el CRUD del admin)
  async findAll(): Promise<Usuario[]> {
    return this.usuarioRepo.find();
  }
}