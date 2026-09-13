import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Sucursal } from '../../branches/entities/sucursal.entity';
import { VarianteProducto } from '../../catalog/entities/variante-producto.entity';

@Entity('inventario')
@Unique(['sucursal', 'variante'])
export class Inventario {
  @PrimaryGeneratedColumn({ name: 'id_inventario' })
  idInventario: number;

  @Column({ name: 'stock_disponible', default: 0 })
  stockDisponible: number;

  @Column({ name: 'stock_reservado', default: 0 })
  stockReservado: number;

  @ManyToOne(() => Sucursal, { eager: true })
  @JoinColumn({ name: 'id_sucursal' })
  sucursal: Sucursal;

  @ManyToOne(() => VarianteProducto, { eager: true })
  @JoinColumn({ name: 'id_variante' })
  variante: VarianteProducto;
}