import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Empresa } from './empresa.entity';
import { Plan } from './plan.entity';

export type EstadoSuscripcion = 'ACTIVA' | 'VENCIDA' | 'CANCELADA';

/**
 * Historial de suscripciones de una empresa. Solo una puede estar ACTIVA a la vez
 * (índice único parcial creado en la migración AddMultitenancy).
 */
@Entity('suscripcion')
@Index('UQ_suscripcion_activa_empresa', ['empresa'], {
  unique: true,
  where: `estado = 'ACTIVA'`,
})
export class Suscripcion {
  @PrimaryGeneratedColumn({ name: 'id_suscripcion' })
  idSuscripcion: number;

  @ManyToOne(() => Empresa, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_empresa' })
  empresa: Relation<Empresa>;

  @ManyToOne(() => Plan, { eager: true, nullable: false })
  @JoinColumn({ name: 'id_plan' })
  plan: Relation<Plan>;

  @Column({ name: 'fecha_inicio', type: 'date' })
  fechaInicio: string;

  @Column({ name: 'fecha_vencimiento', type: 'date' })
  fechaVencimiento: string;

  @Column({ length: 20, default: 'ACTIVA' })
  estado: EstadoSuscripcion;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
