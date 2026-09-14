import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
} from 'typeorm';
import { Usuario } from '../../users/entities/user.entity';
import { Sucursal } from '../../branches/entities/sucursal.entity';
import { Reserva } from '../../reservations/entities/reserva.entity';
import { DetalleVenta } from './detalle-venta.entity';

export type TipoVenta = 'DIGITAL' | 'PRESENCIAL';
export type EstadoVenta =
  | 'PENDIENTE'
  | 'PAGADA'
  | 'CANCELADA'
  | 'DEVUELTA_PARCIAL'
  | 'DEVUELTA';

@Entity('venta')
export class Venta {
  @PrimaryGeneratedColumn({ name: 'id_venta' })
  idVenta: number;

  @Column({ name: 'tipo_venta', length: 20 })
  tipoVenta: TipoVenta;

  @CreateDateColumn({ name: 'fecha' })
  fecha: Date;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  total: number;

  @Column({ name: 'numero_comprobante', length: 50, unique: true, nullable: true })
  numeroComprobante: string;

  @Column({ length: 30, default: 'PENDIENTE' })
  estado: EstadoVenta;

  @ManyToOne(() => Usuario, { eager: true, nullable: true })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;

  @ManyToOne(() => Sucursal, { eager: true })
  @JoinColumn({ name: 'id_sucursal' })
  sucursal: Sucursal;

  @ManyToOne(() => Usuario, { eager: true, nullable: true })
  @JoinColumn({ name: 'id_cajero' })
  cajero: Usuario;

  @ManyToOne(() => Reserva, { eager: true, nullable: true })
  @JoinColumn({ name: 'id_reserva' })
  reserva: Reserva;

  @OneToMany(() => DetalleVenta, (detalle) => detalle.venta, {
    cascade: true,
    eager: true,
  })
  detalles: DetalleVenta[];
}