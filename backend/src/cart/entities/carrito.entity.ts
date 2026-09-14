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
  usuario: Usuario;

  @OneToMany(() => DetalleCarrito, (detalle) => detalle.carrito, {
    cascade: true,
    eager: true,
  })
  detalles: DetalleCarrito[];
}