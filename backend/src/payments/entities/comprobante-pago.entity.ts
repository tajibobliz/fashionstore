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
import { TenantOwned } from '../../tenancy/tenant-owned.entity';
import { Pago } from './pago.entity';

/**
 * Comprobante que sube la clienta al pagar por QR o transferencia (imagen o PDF).
 * Uno por pago: si lo vuelve a subir, se reemplaza. El personal lo revisa antes de aprobar.
 */
@Entity('comprobante_pago')
@Index('UQ_comprobante_pago_pago', ['pago'], { unique: true })
export class ComprobantePago extends TenantOwned {
  @PrimaryGeneratedColumn({ name: 'id_comprobante' })
  idComprobante: number;

  @ManyToOne(() => Pago, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'id_pago' })
  pago: Relation<Pago>;

  @Column({ type: 'varchar', length: 40 })
  mime: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  nombre: string | null;

  @Column({ type: 'integer' })
  bytes: number;

  @Column({ type: 'bytea', select: false })
  datos: Buffer;

  @CreateDateColumn({ name: 'subido_en', type: 'timestamptz' })
  subidoEn: Date;
}
