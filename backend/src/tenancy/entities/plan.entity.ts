import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type CodigoPlan = 'BASICO' | 'PROFESIONAL' | 'EMPRESARIAL';

/** Funcionalidades que un plan puede habilitar (se guardan en `features` como JSON). */
export interface PlanFeatures {
  /** Reportes generativos con IA y por voz. */
  aiReports: boolean;
  /** Módulo de analítica con Machine Learning. */
  ml: boolean;
}

/**
 * Plan de suscripción de la plataforma SaaS.
 * Los límites son configurables desde la BD (requisito 9.4). `null` = ilimitado.
 */
@Entity('plan')
export class Plan {
  @PrimaryGeneratedColumn({ name: 'id_plan' })
  idPlan: number;

  @Column({ length: 30, unique: true })
  codigo: CodigoPlan;

  @Column({ length: 80 })
  nombre: string;

  /** Máximo de sucursales activas (tiendas físicas). */
  @Column({ name: 'max_sucursales', type: 'integer', nullable: true })
  maxSucursales: number | null;

  /** Máximo de empleados activos (usuarios con rol distinto de CLIENTE). */
  @Column({ name: 'max_usuarios', type: 'integer', nullable: true })
  maxUsuarios: number | null;

  @Column({ type: 'jsonb', default: () => `'{}'` })
  features: PlanFeatures;

  /** Precio de referencia mensual (simulado, sin cobro real). */
  @Column({
    name: 'precio_referencia',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  precioReferencia: number;

  @Column({ default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
