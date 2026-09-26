import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { Role } from '../auth/enums/role.enum';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario } from './entities/user.entity';
import { Rol } from './entities/rol.entity';
import { UsuarioSucursal } from './entities/usuario-sucursal.entity';
import { Sucursal } from '../branches/entities/sucursal.entity';

@Injectable()
export class UsersService {
  async createByStaff(dto: CreateUserDto, actorRole: Role) {
    const permitted = actorRole === Role.ADMIN ||
      (actorRole === Role.ENCARGADO && [Role.ENCARGADO_SUCURSAL, Role.CAJERO, Role.CLIENTE, Role.PROVEEDOR].includes(dto.rolNombre)) ||
      (actorRole === Role.ENCARGADO_SUCURSAL && dto.rolNombre === Role.CAJERO) ||
      (actorRole === Role.CAJERO && [Role.CLIENTE, Role.PROVEEDOR].includes(dto.rolNombre));
    if (!permitted) throw new ForbiddenException('No tienes permiso para crear usuarios con ese rol');
    const requiresBranch = [Role.ENCARGADO_SUCURSAL, Role.CAJERO].includes(dto.rolNombre);
    const branchIds = [...new Set(dto.idSucursales ?? [])];
    if (requiresBranch && branchIds.length === 0) {
      throw new ConflictException('Debes asignar al menos una sucursal al personal operativo');
    }
    if (requiresBranch && branchIds.length !== 1) {
      throw new ConflictException('Cada empleado operativo debe pertenecer a una sola sucursal');
    }
    const branches = branchIds.length ? await this.sucursalRepo.findByIds(branchIds) : [];
    if (branches.length !== branchIds.length || branches.some((branch) => !branch.estado)) {
      throw new NotFoundException('Una o más sucursales no existen o están inactivas');
    }
    const user = await this.create(dto);
    if (branches.length) {
      const assignments = branches.map((sucursal) => this.usuarioSucursalRepo.create({ usuario: user, sucursal, estado: true }));
      await this.usuarioSucursalRepo.save(assignments);
    }
    return { idUsuario: user.idUsuario, nombre: user.nombre, email: user.email, rol: user.rol.nombre, sucursales: branches };
  }

  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    @InjectRepository(Rol)
    private readonly rolRepo: Repository<Rol>,
    @InjectRepository(UsuarioSucursal) private readonly usuarioSucursalRepo: Repository<UsuarioSucursal>,
    @InjectRepository(Sucursal) private readonly sucursalRepo: Repository<Sucursal>,
  ) {}

  // Busca un usuario por email (usado para login)
  async findByEmail(email: string): Promise<Usuario | null> {
    return this.usuarioRepo.findOne({ where: { email } });
  }

  // Solo autenticación necesita cargar el hash, oculto por defecto en la entidad.
  async findByEmailWithPassword(email: string): Promise<Usuario | null> {
    return this.usuarioRepo
      .createQueryBuilder('usuario')
      .addSelect('usuario.passwordHash')
      .leftJoinAndSelect('usuario.rol', 'rol')
      .where('usuario.email = :email', { email })
      .getOne();
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

  findClientes(query = '') {
    return this.usuarioRepo.createQueryBuilder('usuario').leftJoinAndSelect('usuario.rol', 'rol').where("rol.nombre = 'CLIENTE'" ).andWhere('usuario.estado = true').andWhere('(LOWER(usuario.nombre) LIKE LOWER(:query) OR LOWER(usuario.apellido) LIKE LOWER(:query) OR LOWER(usuario.email) LIKE LOWER(:query))', { query: `%${query}%` }).orderBy('usuario.nombre', 'ASC').take(20).getMany();
  }

  async assignBranch(idUsuario: number, idSucursal: number) {
    const [usuario, sucursal] = await Promise.all([
      this.findById(idUsuario),
      this.sucursalRepo.findOne({ where: { idSucursal } }),
    ]);
    if (!sucursal) throw new NotFoundException(`Sucursal ${idSucursal} no encontrada`);
    let assignment = await this.usuarioSucursalRepo.findOne({
      where: { usuario: { idUsuario }, sucursal: { idSucursal } },
    });
    if ([Role.ENCARGADO_SUCURSAL, Role.CAJERO].includes(usuario.rol.nombre as Role)) {
      const activeAssignments = await this.usuarioSucursalRepo.find({ where: { usuario: { idUsuario }, estado: true } });
      for (const other of activeAssignments) {
        if (other.sucursal.idSucursal !== idSucursal) {
          other.estado = false;
          await this.usuarioSucursalRepo.save(other);
        }
      }
    }
    if (assignment) assignment.estado = true;
    else assignment = this.usuarioSucursalRepo.create({ usuario, sucursal, estado: true });
    return this.usuarioSucursalRepo.save(assignment);
  }

  listBranches(idUsuario: number) {
    return this.usuarioSucursalRepo.find({ where: { usuario: { idUsuario } } });
  }

  async deactivateBranch(idUsuario: number, idSucursal: number) {
    const assignment = await this.usuarioSucursalRepo.findOne({
      where: { usuario: { idUsuario }, sucursal: { idSucursal } },
    });
    if (!assignment) throw new NotFoundException('Asignación no encontrada');
    const role = assignment.usuario.rol.nombre as Role;
    if ([Role.ENCARGADO_SUCURSAL, Role.CAJERO].includes(role)) {
      const activeAssignments = await this.usuarioSucursalRepo.count({ where: { usuario: { idUsuario }, estado: true } });
      if (activeAssignments <= 1 && assignment.estado) {
        throw new ConflictException('El personal operativo debe conservar al menos una sucursal activa');
      }
    }
    assignment.estado = false;
    return this.usuarioSucursalRepo.save(assignment);
  }
}
