import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { DataSource, EntityManager } from 'typeorm';
import { Empresa } from './entities/empresa.entity';
import { Plan } from './entities/plan.entity';
import { Suscripcion } from './entities/suscripcion.entity';
import { Usuario } from '../users/entities/user.entity';
import { Rol } from '../users/entities/rol.entity';
import { PlanService, hoy, sumarMeses } from './plan.service';
import { CreateEmpresaDto, UpdatePlanDto } from './dto/platform.dto';

/** Slugs que no se pueden usar porque chocan con rutas de la app. */
const SLUGS_RESERVADOS = new Set([
  'admin',
  'api',
  'app',
  'login',
  'platform',
  'plataforma',
  't',
  'tienda',
  'www',
]);

/**
 * Administración de empresas y suscripciones (enunciado §9.3 y §9.5).
 * No hay cobro real: contratar, cambiar y renovar planes se simula administrativamente.
 */
@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly plans: PlanService,
  ) {}

  esReservado(slug: string) {
    return SLUGS_RESERVADOS.has(slug);
  }

  listarPlanes() {
    return this.dataSource
      .getRepository(Plan)
      .find({ order: { idPlan: 'ASC' } });
  }

  async actualizarPlan(idPlan: number, dto: UpdatePlanDto) {
    const repo = this.dataSource.getRepository(Plan);
    const plan = await repo.findOne({ where: { idPlan } });
    if (!plan) throw new NotFoundException(`Plan ${idPlan} no encontrado`);
    if (dto.features) plan.features = { ...plan.features, ...dto.features };
    const { features: _f, ...resto } = dto;
    Object.assign(plan, resto);
    const saved = await repo.save(plan);
    this.plans.invalidarTodo();
    return saved;
  }

  /** Lista de empresas con su plan, estado de suscripción y uso. */
  async listarEmpresas() {
    const empresas = await this.dataSource
      .getRepository(Empresa)
      .find({ order: { idEmpresa: 'ASC' } });
    return Promise.all(empresas.map((e) => this.resumen(e.idEmpresa)));
  }

  /** Resumen de una empresa: lo que ve su administrador en /tenant/me. */
  async resumen(idEmpresa: number) {
    this.plans.invalidar(idEmpresa);
    const e = await this.plans.estado(idEmpresa);
    const uso = await this.plans.uso(idEmpresa);
    return {
      empresa: {
        idEmpresa: e.empresa.idEmpresa,
        nombre: e.empresa.nombre,
        slug: e.empresa.slug,
        estado: e.empresa.estado,
      },
      suscripcion: e.suscripcion
        ? {
            idSuscripcion: e.suscripcion.idSuscripcion,
            estado: e.estado,
            fechaInicio: e.suscripcion.fechaInicio,
            fechaVencimiento: e.suscripcion.fechaVencimiento,
            diasRestantes: e.diasRestantes,
          }
        : { estado: e.estado },
      plan: e.plan
        ? {
            codigo: e.plan.codigo,
            nombre: e.plan.nombre,
            features: e.plan.features,
          }
        : null,
      limites: {
        sucursales: {
          usadas: uso.sucursales,
          maximo: e.plan?.maxSucursales ?? null,
        },
        usuarios: { usados: uso.usuarios, maximo: e.plan?.maxUsuarios ?? null },
      },
    };
  }

  historial(idEmpresa: number) {
    return this.dataSource.getRepository(Suscripcion).find({
      where: { empresa: { idEmpresa } },
      order: { idSuscripcion: 'DESC' },
    });
  }

  /** Registra una empresa contratante con su plan y su administrador. */
  async crearEmpresa(dto: CreateEmpresaDto) {
    const slug = dto.slug.toLowerCase();
    if (SLUGS_RESERVADOS.has(slug))
      throw new BadRequestException(`El slug "${slug}" está reservado`);

    const idEmpresa = await this.dataSource.transaction(async (m) => {
      if (await m.findOne(Empresa, { where: { slug } }))
        throw new ConflictException(
          `Ya existe una empresa con el slug "${slug}"`,
        );
      const empresa = await m.save(
        Empresa,
        m.create(Empresa, { nombre: dto.nombre, slug, nit: dto.nit ?? null }),
      );
      await this.nuevaSuscripcion(m, empresa, dto.codigoPlan, dto.meses ?? 1);

      const rol = await m.findOneOrFail(Rol, { where: { nombre: 'ADMIN' } });
      await m.save(
        Usuario,
        m.create(Usuario, {
          nombre: dto.admin.nombre,
          apellido: dto.admin.apellido,
          email: dto.admin.email,
          passwordHash: await bcrypt.hash(dto.admin.password, 10),
          estado: true,
          rol,
          idEmpresa: empresa.idEmpresa,
        }),
      );
      return empresa.idEmpresa;
    });
    return this.resumen(idEmpresa);
  }

  async cambiarEstado(idEmpresa: number, estado: 'ACTIVA' | 'SUSPENDIDA') {
    const repo = this.dataSource.getRepository(Empresa);
    const empresa = await repo.findOne({ where: { idEmpresa } });
    if (!empresa)
      throw new NotFoundException(`Empresa ${idEmpresa} no encontrada`);
    empresa.estado = estado;
    await repo.save(empresa);
    return this.resumen(idEmpresa);
  }

  /**
   * Asigna, cambia o renueva el plan: la suscripción ACTIVA pasa a CANCELADA (queda en el
   * historial) y se crea una nueva desde hoy. Si se baja de plan y la empresa ya supera algún
   * límite, no se borra nada: solo se bloquea crear o activar más (ver `resumen().limites`).
   */
  async cambiarPlan(idEmpresa: number, codigoPlan: string, meses = 1) {
    await this.dataSource.transaction(async (m) => {
      const empresa = await m.findOne(Empresa, { where: { idEmpresa } });
      if (!empresa)
        throw new NotFoundException(`Empresa ${idEmpresa} no encontrada`);
      await m.update(
        Suscripcion,
        { empresa: { idEmpresa }, estado: 'ACTIVA' },
        { estado: 'CANCELADA' },
      );
      await this.nuevaSuscripcion(m, empresa, codigoPlan, meses);
    });
    return this.resumen(idEmpresa);
  }

  /** Solo para simular vencimientos (pruebas y defensa). */
  async fijarVencimiento(idEmpresa: number, fechaVencimiento: string) {
    const repo = this.dataSource.getRepository(Suscripcion);
    const activa = await repo.findOne({
      where: { empresa: { idEmpresa }, estado: 'ACTIVA' },
    });
    if (!activa)
      throw new NotFoundException('La empresa no tiene una suscripción activa');
    activa.fechaVencimiento = fechaVencimiento;
    await repo.save(activa);
    return this.resumen(idEmpresa);
  }

  private async nuevaSuscripcion(
    m: EntityManager,
    empresa: Empresa,
    codigoPlan: string,
    meses: number,
  ) {
    const plan = await m.findOne(Plan, {
      where: { codigo: codigoPlan as Plan['codigo'], activo: true },
    });
    if (!plan) throw new NotFoundException(`Plan ${codigoPlan} no disponible`);
    const inicio = hoy();
    await m.save(
      Suscripcion,
      m.create(Suscripcion, {
        empresa,
        plan,
        estado: 'ACTIVA',
        fechaInicio: inicio,
        fechaVencimiento: sumarMeses(inicio, meses),
      }),
    );
    this.plans.invalidar(empresa.idEmpresa);
  }
}
