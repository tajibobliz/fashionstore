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
import { DetalleCarrito } from './detalle-carrito.entity';
import { Sucursal } from '../../branches/entities/sucursal.entity';

export type EstadoCarrito = 'ACTIVO' | 'CONVERTIDO' | 'ABANDONADO' | 'CANCELADO';

@Entity('carrito')
export class Carrito {
  @PrimaryGeneratedColumn({ name: 'id_carrito' })
  idCarrito: number;

  @CreateDateColumn({ name: 'fecha' })
  fecha: Date;

  @Column({ length: 30, default: 'ACTIVO' })
  estado: EstadoCarrito;

  @ManyToOne(() => Usuario, { eager: true })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Relation<Usuario>;

  @ManyToOne(() => Sucursal, { eager: true, nullable: true })
  @JoinColumn({ name: 'id_sucursal' })
  sucursal: Relation<Sucursal> | null;

  @OneToMany(() => DetalleCarrito, (detalle) => detalle.carrito, {
    cascade: true,
    eager: true,
  })
  detalles: Relation<DetalleCarrito[]>;
}
