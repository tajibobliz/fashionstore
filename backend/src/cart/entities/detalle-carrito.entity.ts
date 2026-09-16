import type { Relation } from 'typeorm';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Carrito } from './carrito.entity';
import { VarianteProducto } from '../../catalog/entities/variante-producto.entity';

@Entity('detalle_carrito')
@Unique(['carrito', 'variante'])
export class DetalleCarrito {
  @PrimaryGeneratedColumn({ name: 'id_detalle_carrito' })
  idDetalleCarrito: number;

  @Column()
  cantidad: number;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  precio: number;

  @ManyToOne(() => Carrito, (carrito) => carrito.detalles, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'id_carrito' })
  carrito: Relation<Carrito>;

  @ManyToOne(() => VarianteProducto, { eager: true })
  @JoinColumn({ name: 'id_variante' })
  variante: Relation<VarianteProducto>;
}
