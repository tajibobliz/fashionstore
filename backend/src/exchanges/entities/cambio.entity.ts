import type { Relation } from 'typeorm';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TenantOwned } from '../../tenancy/tenant-owned.entity';
import { Venta } from '../../sales/entities/venta.entity';
import { Usuario } from '../../users/entities/user.entity';
import { DetalleCambio } from './detalle-cambio.entity';

/**
 * Cambio de prendas (Fase 2, aporte exigido): la clienta devuelve prendas de una venta y
 * se lleva otras, dentro del plazo de cambio de la empresa (`empresa.plazo_cambio_dias`).
 * La venta original no cambia de estado: el cambio queda como historial aparte.
 */
@Entity('cambio')
export class Cambio extends TenantOwned {
  @PrimaryGeneratedColumn({ name: 'id_cambio' })
  idCambio: number;

  @CreateDateColumn({ name: 'fecha', type: 'timestamptz' })
  fecha: Date;

  @Column({ type: 'varchar', length: 300, nullable: true })
  motivo: string | null;

  @ManyToOne(() => Venta, { eager: true })
  @JoinColumn({ name: 'id_venta' })
  venta: Relation<Venta>;

  @ManyToOne(() => Usuario, { eager: true })
  @JoinColumn({ name: 'id_usuario_registra' })
  usuarioRegistra: Relation<Usuario>;

  /** Positiva: la clienta paga la diferencia. Negativa: se le devuelve. */
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  diferencia: number;

  @Column({
    name: 'metodo_pago_diferencia',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  metodoPagoDiferencia: string | null;

  @OneToMany(() => DetalleCambio, (d) => d.cambio, {
    cascade: true,
    eager: true,
  })
  detalles: Relation<DetalleCambio[]>;
}
