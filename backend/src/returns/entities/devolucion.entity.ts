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
import { Venta } from '../../sales/entities/venta.entity';
import { Usuario } from '../../users/entities/user.entity';
import { DetalleDevolucion } from './detalle-devolucion.entity';

@Entity('devolucion')
export class Devolucion {
  @PrimaryGeneratedColumn({ name: 'id_devolucion' })
  idDevolucion: number;

  @CreateDateColumn({ name: 'fecha' })
  fecha: Date;

  @Column({ length: 300, nullable: true })
  motivo: string;

  @ManyToOne(() => Venta, { eager: true })
  @JoinColumn({ name: 'id_venta' })
  venta: Relation<Venta>;

  @ManyToOne(() => Usuario, { eager: true })
  @JoinColumn({ name: 'id_usuario_registra' })
  usuarioRegistra: Relation<Usuario>;

  @OneToMany(() => DetalleDevolucion, (detalle) => detalle.devolucion, {
    cascade: true,
    eager: true,
  })
  detalles: Relation<DetalleDevolucion[]>;
}
