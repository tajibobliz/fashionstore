import type { Relation } from 'typeorm';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TenantOwned } from '../../tenancy/tenant-owned.entity';
import { Sucursal } from '../../branches/entities/sucursal.entity';
import { Almacen } from '../../warehouses/entities/almacen.entity';
import { Usuario } from '../../users/entities/user.entity';
import { DetalleTraspaso } from './detalle-traspaso.entity';

/**
 * Estados del traspaso (CU14 / RN-013):
 *  - EN_TRANSITO: ya salió del almacén de origen (stock descontado) y aún no llega.
 *  - RECIBIDO: el destino recibió todo.
 *  - RECIBIDO_PARCIAL: llegó una parte; la diferencia queda registrada como merma.
 *  - RECHAZADO: el destino no aceptó nada (todo es merma).
 *  - CANCELADO: el origen lo anuló antes de que llegara; el stock vuelve al origen.
 */
export const ESTADOS_TRASPASO = [
  'EN_TRANSITO',
  'RECIBIDO',
  'RECIBIDO_PARCIAL',
  'RECHAZADO',
  'CANCELADO',
] as const;
export type EstadoTraspaso = (typeof ESTADOS_TRASPASO)[number];

/** Traspaso de inventario entre dos sucursales de la misma empresa (CU14, RF-025). */
@Entity('traspaso')
@Index('IDX_traspaso_estado', ['idEmpresa', 'estado'])
@Check(
  'CHK_traspaso_estado',
  `estado IN ('EN_TRANSITO','RECIBIDO','RECIBIDO_PARCIAL','RECHAZADO','CANCELADO')`,
)
@Check('CHK_traspaso_sucursales', 'id_sucursal_origen <> id_sucursal_destino')
export class Traspaso extends TenantOwned {
  @PrimaryGeneratedColumn({ name: 'id_traspaso' })
  idTraspaso: number;

  @Column({ type: 'varchar', length: 20, default: 'EN_TRANSITO' })
  estado: EstadoTraspaso;

  @ManyToOne(() => Sucursal, { eager: true })
  @JoinColumn({ name: 'id_sucursal_origen' })
  sucursalOrigen: Relation<Sucursal>;

  @ManyToOne(() => Almacen, { eager: true })
  @JoinColumn({ name: 'id_almacen_origen' })
  almacenOrigen: Relation<Almacen>;

  @ManyToOne(() => Sucursal, { eager: true })
  @JoinColumn({ name: 'id_sucursal_destino' })
  sucursalDestino: Relation<Sucursal>;

  @ManyToOne(() => Almacen, { eager: true })
  @JoinColumn({ name: 'id_almacen_destino' })
  almacenDestino: Relation<Almacen>;

  @Column({ type: 'varchar', length: 300, nullable: true })
  observacion: string | null;

  @CreateDateColumn({ name: 'fecha_envio', type: 'timestamptz' })
  fechaEnvio: Date;

  @ManyToOne(() => Usuario, { eager: true })
  @JoinColumn({ name: 'id_usuario_envia' })
  usuarioEnvia: Relation<Usuario>;

  @Column({ name: 'fecha_cierre', type: 'timestamptz', nullable: true })
  fechaCierre: Date | null;

  /** Quien lo recibió o lo canceló. */
  @ManyToOne(() => Usuario, { eager: true, nullable: true })
  @JoinColumn({ name: 'id_usuario_cierra' })
  usuarioCierra: Relation<Usuario> | null;

  /** Nota de la recepción (motivo de la merma) o de la cancelación. */
  @Column({
    name: 'observacion_cierre',
    type: 'varchar',
    length: 300,
    nullable: true,
  })
  observacionCierre: string | null;

  @OneToMany(() => DetalleTraspaso, (d) => d.traspaso, {
    cascade: true,
    eager: true,
  })
  detalles: Relation<DetalleTraspaso[]>;
}
