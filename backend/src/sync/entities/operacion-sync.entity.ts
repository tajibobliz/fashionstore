import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { TenantOwned } from '../../tenancy/tenant-owned.entity';
import { Sucursal } from '../../branches/entities/sucursal.entity';
import { Usuario } from '../../users/entities/user.entity';

export type TipoOperacionSync = 'VENTA' | 'RESERVA';
export type EstadoOperacionSync = 'CONFIRMADA' | 'RECHAZADA' | 'CONFLICTO';
/**
 * STOCK: venta presencial registrada con faltante (la prenda ya se entregó).
 * SIN_STOCK: reserva no registrada porque el stock ya no alcanza.
 * PRECIO: venta registrada con un precio local distinto al vigente fuera de la ventana permitida.
 * TURNO_CERRADO: venta registrada en un turno que se cerró antes de sincronizar.
 */
export type TipoConflictoSync =
  'STOCK' | 'SIN_STOCK' | 'PRECIO' | 'TURNO_CERRADO';

/** Detalle mínimo de la operación (sin datos personales): para auditoría y para resolver conflictos. */
export interface DetalleOperacionSync {
  items: {
    idVariante: number;
    cantidad: number;
    precioLocal?: number;
    precioServidor?: number;
    faltante?: number;
  }[];
  alternativas?: {
    idSucursal: number;
    sucursal: string;
    idVariante: number;
    stock: number;
  }[];
}

/**
 * Registro de cada operación que llega desde un dispositivo offline (PWA o app móvil).
 * Es la "bitácora" de sincronización: permite la idempotencia (el mismo operationId
 * devuelve el mismo resultado) y el panel de conflictos del encargado.
 */
@Entity('operacion_sync')
@Unique('UQ_operacion_sync_empresa_operacion', ['idEmpresa', 'operationId'])
export class OperacionSync extends TenantOwned {
  @PrimaryGeneratedColumn({ name: 'id_operacion_sync' })
  idOperacionSync: number;

  /** UUID generado por el dispositivo al crear la operación sin conexión. */
  @Column({ name: 'operation_id', type: 'uuid' })
  operationId: string;

  @Column({ name: 'device_id', length: 100 })
  deviceId: string;

  @Column({ length: 20 })
  tipo: TipoOperacionSync;

  @Column({ length: 20 })
  estado: EstadoOperacionSync;

  /** Tipos de conflicto separados por coma (p. ej. "STOCK,PRECIO"). */
  @Column({ type: 'varchar', length: 100, nullable: true })
  conflictos: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  motivo: string | null;

  /** id de la venta o reserva creada en el servidor (si se registró). */
  @Column({ name: 'server_id', type: 'integer', nullable: true })
  serverId: number | null;

  @ManyToOne(() => Sucursal, { eager: true, nullable: true })
  @JoinColumn({ name: 'id_sucursal' })
  sucursal: Relation<Sucursal> | null;

  @ManyToOne(() => Usuario, { eager: true })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Relation<Usuario>;

  /** Hora del dispositivo al crear la operación: solo para auditoría, no decide el orden. */
  @Column({ name: 'creada_local_en', type: 'timestamptz' })
  creadaLocalEn: Date;

  @CreateDateColumn({ name: 'recibida_en', type: 'timestamptz' })
  recibidaEn: Date;

  @UpdateDateColumn({ name: 'actualizada_en', type: 'timestamptz' })
  actualizadaEn: Date;

  /** Cuántas veces llegó la misma operación (reintentos del dispositivo). */
  @Column({ default: 1 })
  intentos: number;

  @Column({ type: 'jsonb', nullable: true })
  detalle: DetalleOperacionSync | null;

  /** Un conflicto queda pendiente hasta que el encargado lo revisa. */
  @Column({ default: false })
  resuelta: boolean;

  @Column({ name: 'resuelta_en', type: 'timestamptz', nullable: true })
  resueltaEn: Date | null;

  @ManyToOne(() => Usuario, { eager: false, nullable: true })
  @JoinColumn({ name: 'id_usuario_resolucion' })
  resueltaPor: Relation<Usuario> | null;

  @Column({
    name: 'nota_resolucion',
    type: 'varchar',
    length: 300,
    nullable: true,
  })
  notaResolucion: string | null;
}
