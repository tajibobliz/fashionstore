import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Inventario } from './inventario.entity';

export type TipoMovimiento =
  | 'ENTRADA'
  | 'RESERVA'
  | 'LIBERACION_RESERVA'
  | 'VENTA'
  | 'DEVOLUCION'
  | 'AJUSTE';

@Entity('movimiento_inventario')
export class MovimientoInventario {
  @PrimaryGeneratedColumn({ name: 'id_movimiento' })
  idMovimiento: number;

  @Column({ length: 30 })
  tipo: TipoMovimiento;

  @Column()
  cantidad: number;

  @CreateDateColumn({ name: 'fecha' })
  fecha: Date;

  @Column({ length: 100, nullable: true })
  referencia: string;

  @ManyToOne(() => Inventario, { eager: true })
  @JoinColumn({ name: 'id_inventario' })
  inventario: Inventario;
}