import { MONEDA_POR_DEFECTO } from '../common/monedas';
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
        moneda: e.empresa.moneda,
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

  async cambiarMoneda(idEmpresa: number, moneda: string) {
    await this.dataSource
      .getRepository(Empresa)
      .update({ idEmpresa }, { moneda });
    this.plans.invalidar(idEmpresa);
    return { moneda };
  }

  /** Plazo de la sesión offline con PIN (CU17). Se aplica la próxima vez que cada usuario esté en línea. */
  async cambiarSesionOffline(idEmpresa: number, horasSesionOffline: number) {
    await this.dataSource
      .getRepository(Empresa)
      .update({ idEmpresa }, { horasSesionOffline });
    return { horasSesionOffline };
  }

  historial(idEmpresa: number) {
    return this.dataSource.getRepository(Suscripcion).find({
      where: { empresa: { idEmpresa } },
      order: { idSuscripcion: 'DESC' },
    });
  }

  /** Registra una empresa contratante con su plan y su administrador. */
  /**
   * Crea la empresa con su administrador. `conSuscripcion: false` (contratación desde la página
   * pública) la deja SIN suscripción hasta que se confirme el pago; el administrador de la
   * plataforma la crea con el plan ya activo (pago manual: transferencia o QR).
   */
  async crearEmpresa(
    dto: CreateEmpresaDto,
    { conSuscripcion = true }: { conSuscripcion?: boolean } = {},
  ) {
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
        m.create(Empresa, {
          nombre: dto.nombre,
          slug,
          nit: dto.nit ?? null,
          moneda: dto.moneda ?? MONEDA_POR_DEFECTO,
        }),
      );
      if (conSuscripcion)
        await this.nuevaSuscripcion(m, empresa, dto.codigoPlan, dto.meses ?? 1);
      else if (
        !(await m.findOne(Plan, {
          where: { codigo: dto.codigoPlan as Plan['codigo'], activo: true },
        }))
      )
        throw new NotFoundException(`Plan ${dto.codigoPlan} no disponible`);

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

  /**
   * Activa el plan pagado dentro de la transacción del pago (lo usa BillingService).
   * Renovar el MISMO plan aún vigente suma los meses al vencimiento actual (no se pierden días
   * pagados); cambiar de plan empieza hoy. La suscripción anterior queda CANCELADA en el historial.
   */
  async activarPlanEn(
    m: EntityManager,
    idEmpresa: number,
    codigoPlan: string,
    meses: number,
  ): Promise<Suscripcion> {
    const empresa = await m.findOne(Empresa, { where: { idEmpresa } });
    if (!empresa)
      throw new NotFoundException(`Empresa ${idEmpresa} no encontrada`);
    const plan = await m.findOne(Plan, {
      where: { codigo: codigoPlan as Plan['codigo'] },
    });
    if (!plan) throw new NotFoundException(`Plan ${codigoPlan} no encontrado`);
    const actual = await m.findOne(Suscripcion, {
      where: { empresa: { idEmpresa }, estado: 'ACTIVA' },
    });
    const inicio = hoy();
    const base =
      actual &&
      actual.plan.codigo === codigoPlan &&
      actual.fechaVencimiento >= inicio
        ? actual.fechaVencimiento
        : inicio;
    if (actual) await m.update(Suscripcion, { idSuscripcion: actual.idSuscripcion }, { estado: 'CANCELADA' });
    const nueva = await m.save(
      Suscripcion,
      m.create(Suscripcion, {
        empresa,
        plan,
        estado: 'ACTIVA',
        fechaInicio: inicio,
        fechaVencimiento: sumarMeses(base, meses),
      }),
    );
    this.plans.invalidar(idEmpresa);
    return nueva;
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
