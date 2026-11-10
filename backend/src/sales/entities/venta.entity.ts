import { TenantOwned } from '../../tenancy/tenant-owned.entity';
import type { Relation } from 'typeorm';
import {
  Index,
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
@Index('IDX_venta_pago_diferido_vence', ['pagoVenceEn'], {
  where: `"pago_diferido" AND "estado" = 'PENDIENTE'`,
})
@Unique('UQ_venta_empresa_comprobante', ['idEmpresa', 'numeroComprobante'])
export class Venta extends TenantOwned {
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

  @Column({ name: 'numero_comprobante', length: 50, nullable: true })
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

  /**
   * Pedido hecho sin conexión con pago diferido (CU16, plan Empresarial): la clienta lo paga
   * al volver la red, antes de `pagoVenceEn`; si no, se cancela solo.
   */
  @Column({ name: 'pago_diferido', default: false })
  pagoDiferido: boolean;

  @Column({ name: 'pago_vence_en', type: 'timestamptz', nullable: true })
  pagoVenceEn: Date | null;

  /**
   * Total que vio la clienta sin conexión. Si el servidor cobra otro (cambió el precio),
   * debe aceptar el nuevo total antes de pagar; al aceptarlo se iguala a `total`.
   */
  @Column({
    name: 'total_estimado',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  totalEstimado: number | null;
}
