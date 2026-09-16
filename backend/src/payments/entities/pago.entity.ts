import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Venta } from '../../sales/entities/venta.entity';

export type MetodoPago = 'EFECTIVO' | 'TARJETA' | 'QR' | 'TRANSFERENCIA' | 'CONTRAPAGO';
export type EstadoPago = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'ANULADO';

@Entity('pago')
export class Pago {
  @PrimaryGeneratedColumn({ name: 'id_pago' })
  idPago: number;

  /** UUID generado por el cliente para reintentos seguros. */
  @Column({ name: 'client_request_id', type: 'uuid', nullable: true })
  clientRequestId: string | null;

  @Column({ length: 30 })
  metodo: MetodoPago;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  monto: number;

  @Column({ length: 30, default: 'PENDIENTE' })
  estado: EstadoPago;

  @Column({ name: 'referencia_pasarela', length: 150, nullable: true })
  referenciaPasarela: string;

  @CreateDateColumn({ name: 'fecha' })
  fecha: Date;

  @ManyToOne(() => Venta, { eager: true })
  @JoinColumn({ name: 'id_venta' })
  venta: Venta;
}
