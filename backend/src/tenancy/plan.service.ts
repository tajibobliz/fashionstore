import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Empresa } from './entities/empresa.entity';
import { Plan, PlanFeatures } from './entities/plan.entity';
import { Suscripcion } from './entities/suscripcion.entity';

export type RecursoLimitado = 'sucursales' | 'usuarios';

export interface EstadoSuscripcion {
  empresa: Empresa;
  suscripcion: Suscripcion | null;
  plan: Plan | null;
  /** Estado real: una suscripción ACTIVA con fecha pasada se informa como VENCIDA. */
  estado: 'ACTIVA' | 'VENCIDA' | 'SIN_SUSCRIPCION';
  vigente: boolean;
  diasRestantes: number | null;
}

const CACHE_MS = 30_000;

/**
 * Reglas de los planes de suscripción (enunciado §9.4 y §9.5):
 * - funcionalidades habilitadas (`features`), límites de sucursales y empleados,
 * - vigencia de la suscripción.
 * Los valores salen de la tabla `plan`, así se configuran sin tocar código.
 */
@Injectable()
export class PlanService {
  private readonly cache = new Map<
    number,
    { value: EstadoSuscripcion; expires: number }
  >();

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Estado de la suscripción de una empresa (con caché corta). */
  async estado(idEmpresa: number): Promise<EstadoSuscripcion> {
    const hit = this.cache.get(idEmpresa);
    if (hit && hit.expires > Date.now()) return hit.value;

    const empresa = await this.dataSource
      .getRepository(Empresa)
      .findOne({ where: { idEmpresa } });
    if (!empresa)
      throw new NotFoundException(`Empresa ${idEmpresa} no encontrada`);
    const suscripcion = await this.dataSource
      .getRepository(Suscripcion)
      .findOne({
        where: { empresa: { idEmpresa }, estado: 'ACTIVA' },
        relations: { plan: true },
      });

    const value = PlanService.evaluar(empresa, suscripcion, hoy());
    this.cache.set(idEmpresa, { value, expires: Date.now() + CACHE_MS });
    return value;
  }

  /** Lógica pura (sin BD) para poder probarla con tests unitarios. */
  static evaluar(
    empresa: Empresa,
    suscripcion: Suscripcion | null,
    fechaHoy: string,
  ): EstadoSuscripcion {
    if (!suscripcion) {
      return {
        empresa,
        suscripcion: null,
        plan: null,
        estado: 'SIN_SUSCRIPCION',
        vigente: false,
        diasRestantes: null,
      };
    }
    const dias = Math.round(
      (Date.parse(suscripcion.fechaVencimiento) - Date.parse(fechaHoy)) /
        86_400_000,
    );
    const vigente = dias >= 0;
    return {
      empresa,
      suscripcion,
      plan: suscripcion.plan,
      estado: vigente ? 'ACTIVA' : 'VENCIDA',
      vigente,
      diasRestantes: vigente ? dias : 0,
    };
  }

  invalidar(idEmpresa: number) {
    this.cache.delete(idEmpresa);
  }

  invalidarTodo() {
    this.cache.clear();
  }

  /** 403 si la empresa está suspendida o su suscripción no está vigente. */
  async asegurarVigente(idEmpresa: number) {
    const e = await this.estado(idEmpresa);
    if (e.empresa.estado !== 'ACTIVA') {
      throw new ForbiddenException({
        code: 'EMPRESA_SUSPENDIDA',
        message: 'La empresa está suspendida.',
      });
    }
    if (!e.vigente) {
      throw new ForbiddenException({
        code: 'SUSCRIPCION_VENCIDA',
        message:
          'La suscripción no está vigente: solo se permiten consultas. Renueva el plan para seguir operando.',
      });
    }
    return e;
  }

  /** 403 si el plan no incluye la funcionalidad. */
  async asegurarFuncionalidad(idEmpresa: number, feature: keyof PlanFeatures) {
    const e = await this.asegurarVigente(idEmpresa);
    if (!e.plan?.features?.[feature]) {
      throw new ForbiddenException({
        code: 'PLAN_SIN_FUNCIONALIDAD',
        message: `Tu plan ${e.plan?.nombre ?? ''} no incluye esta funcionalidad. Mejora tu plan para usarla.`,
      });
    }
  }

  /** Cuántos recursos activos usa la empresa. */
  async uso(idEmpresa: number): Promise<Record<RecursoLimitado, number>> {
    const [suc] = await this.dataSource.query(
      `SELECT count(*)::int AS n FROM sucursal WHERE id_empresa = $1 AND estado = true`,
      [idEmpresa],
    );
    const [usr] = await this.dataSource.query(
      `SELECT count(*)::int AS n FROM usuario u JOIN rol r ON r.id_rol = u.id_rol
        WHERE u.id_empresa = $1 AND u.estado = true AND r.nombre NOT IN ('CLIENTE', 'SUPER_ADMIN')`,
      [idEmpresa],
    );
    return { sucursales: suc.n, usuarios: usr.n };
  }

  /** 403 si activar un recurso más supera el límite del plan (NULL = ilimitado). */
  async asegurarCupo(idEmpresa: number, recurso: RecursoLimitado) {
    const e = await this.asegurarVigente(idEmpresa);
    const maximo =
      recurso === 'sucursales' ? e.plan!.maxSucursales : e.plan!.maxUsuarios;
    if (maximo == null) return;
    const usados = (await this.uso(idEmpresa))[recurso];
    if (usados >= maximo) {
      const nombre =
        recurso === 'sucursales' ? 'sucursales activas' : 'empleados activos';
      throw new ForbiddenException({
        code: 'LIMITE_DEL_PLAN',
        message: `Tu plan ${e.plan!.nombre} permite hasta ${maximo} ${nombre} (tienes ${usados}). Mejora tu plan para agregar más.`,
        recurso,
        maximo,
        usados,
      });
    }
  }
}

export function hoy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function sumarMeses(fecha: string, meses: number): string {
  const d = new Date(`${fecha}T00:00:00`);
  d.setMonth(d.getMonth() + meses);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
