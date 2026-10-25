import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { Role } from '../auth/enums/role.enum';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { TenantContext } from '../tenancy/tenant-context';
import { TenantResolverService } from '../tenancy/tenant-resolver.service';
import { PlanService } from '../tenancy/plan.service';
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
    private readonly tenants?: TenantResolverService,
    private readonly plans?: PlanService,
  ) {}

  /** Busca un usuario por email dentro de una empresa (`null` = usuarios de plataforma). */
  async findByEmail(email: string, idEmpresa: number | null): Promise<Usuario | null> {
    return this.usuarioRepo.findOne({ where: { email, idEmpresa: idEmpresa ?? IsNull() } });
  }

  async updatePushToken(idUsuario: number, token: string) {
    await this.usuarioRepo.update({ idUsuario }, { pushToken: token });
    return { message: 'Token de notificaciones actualizado' };
  }

  // Solo autenticación necesita cargar el hash, oculto por defecto en la entidad.
  async findByEmailWithPassword(email: string, idEmpresa: number | null): Promise<Usuario | null> {
    const qb = this.usuarioRepo
      .createQueryBuilder('usuario')
      .addSelect('usuario.passwordHash')
      .leftJoinAndSelect('usuario.rol', 'rol')
      .leftJoinAndSelect('usuario.empresa', 'empresa')
      .where('usuario.email = :email', { email });
    if (idEmpresa == null) qb.andWhere('usuario.id_empresa IS NULL');
    else qb.andWhere('usuario.id_empresa = :idEmpresa', { idEmpresa });
    return qb.getOne();
  }

  // Busca un usuario por id
  async findById(id: number): Promise<Usuario> {
    const user = await this.usuarioRepo.findOne({ where: { idUsuario: id }, relations: { empresa: true } });
    if (!user) throw new NotFoundException(`Usuario ${id} no encontrado`);
    return user;
  }

  // Crea un nuevo usuario con contraseña encriptada
  async create(data: {
    /** Empresa del usuario. Si falta: la del request (TenantContext) o la empresa por defecto. */
    idEmpresa?: number | null;
    nombre: string;
    apellido?: string;
    email: string;
    password: string;
    telefono?: string;
    rolNombre?: string;
  }): Promise<Usuario> {
    // Buscar el rol (por defecto CLIENTE)
    const rolNombre = data.rolNombre || 'CLIENTE';

    // Empresa: la indicada, la del request o la por defecto. SUPER_ADMIN no tiene empresa.
    const idEmpresa =
      data.idEmpresa !== undefined
        ? data.idEmpresa
        : (TenantContext.currentTenantId() ??
          (rolNombre === Role.SUPER_ADMIN ? null : ((await this.tenants?.defaultTenantId()) ?? null)));

    // El email debe ser único dentro de la empresa.
    const existe = await this.findByEmail(data.email, idEmpresa);
    if (existe) throw new ConflictException('El email ya está registrado');

    const rol = await this.rolRepo.findOne({ where: { nombre: rolNombre } });
    if (!rol) throw new NotFoundException(`Rol ${rolNombre} no encontrado`);

    // Los empleados (todo rol que no sea CLIENTE) cuentan para el límite del plan.
    if (idEmpresa != null && rolNombre !== Role.CLIENTE) await this.plans?.asegurarCupo(idEmpresa, 'usuarios');

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
      idEmpresa,
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
