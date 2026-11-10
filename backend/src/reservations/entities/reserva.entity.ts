import { TenantOwned } from '../../tenancy/tenant-owned.entity';
import type { Relation } from 'typeorm';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { Usuario } from '../../users/entities/user.entity';
import { Sucursal } from '../../branches/entities/sucursal.entity';
import { DetalleReserva } from './detalle-reserva.entity';
import { Almacen } from '../../warehouses/entities/almacen.entity';

export type EstadoReserva = 'PENDIENTE' | 'PREPARADA' | 'ATENDIDA' | 'CANCELADA';

@Entity('reserva')
@Unique('UQ_reserva_empresa_codigo', ['idEmpresa', 'codigo'])
export class Reserva extends TenantOwned {
  @PrimaryGeneratedColumn({ name: 'id_reserva' })
  idReserva: number;

  @Column({ length: 50 })
  codigo: string;

  /** UUID generado por el cliente para reintentos seguros. */
  @Column({ name: 'client_request_id', type: 'uuid', nullable: true })
  clientRequestId: string | null;

  @CreateDateColumn({ name: 'fecha_reserva' })
  fechaReserva: Date;

  @Column({ name: 'fecha_atencion', type: 'timestamp', nullable: true })
  fechaAtencion: Date;

  @Column({ length: 30, default: 'PENDIENTE' })
  estado: EstadoReserva;

  @ManyToOne(() => Usuario, { eager: true })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Relation<Usuario>;

  @ManyToOne(() => Sucursal, { eager: true })
  @JoinColumn({ name: 'id_sucursal' })
  sucursal: Relation<Sucursal>;

  @OneToMany(() => DetalleReserva, (detalle) => detalle.reserva, {
    cascade: true,
    eager: true,
  })
  detalles: Relation<DetalleReserva[]>;

  @ManyToOne(() => Almacen, { eager: true, nullable: true })
  @JoinColumn({ name: 'id_almacen_origen' })
  almacenOrigen: Relation<Almacen> | null;
}
