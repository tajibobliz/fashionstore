import type { Relation } from 'typeorm';
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
import { Almacen } from '../../warehouses/entities/almacen.entity';
import { TurnoCaja } from '../../pos/entities/turno-caja.entity';

export type TipoVenta = 'DIGITAL' | 'PRESENCIAL';
export type ModalidadComercial = 'MINORISTA' | 'MAYORISTA';
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

  @Column({ name: 'modalidad_comercial', length: 20, default: 'MINORISTA' })
  modalidadComercial: ModalidadComercial;

  /** UUID generado por el cliente para reintentos seguros. */
  @Column({ name: 'client_request_id', type: 'uuid', nullable: true })
  clientRequestId: string | null;

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
  usuario: Relation<Usuario>;

  @ManyToOne(() => Sucursal, { eager: true })
  @JoinColumn({ name: 'id_sucursal' })
  sucursal: Relation<Sucursal>;

  @ManyToOne(() => Usuario, { eager: true, nullable: true })
  @JoinColumn({ name: 'id_cajero' })
  cajero: Relation<Usuario>;

  @ManyToOne(() => Reserva, { eager: true, nullable: true })
  @JoinColumn({ name: 'id_reserva' })
  reserva: Relation<Reserva>;

  @OneToMany(() => DetalleVenta, (detalle) => detalle.venta, {
    cascade: true,
    eager: true,
  })
  detalles: Relation<DetalleVenta[]>;

  @ManyToOne(() => Almacen, { eager: true, nullable: true })
  @JoinColumn({ name: 'id_almacen' })
  almacen: Relation<Almacen> | null;

  @ManyToOne(() => TurnoCaja, { eager: true, nullable: true })
  @JoinColumn({ name: 'id_turno' })
  turno: Relation<TurnoCaja> | null;
}
