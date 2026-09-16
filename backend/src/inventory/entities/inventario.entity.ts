import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  Check,
} from 'typeorm';
import { Sucursal } from '../../branches/entities/sucursal.entity';
import { VarianteProducto } from '../../catalog/entities/variante-producto.entity';
import { Almacen } from '../../warehouses/entities/almacen.entity';

@Entity('inventario')
@Unique(['almacen', 'variante'])
@Check('CHK_inventario_stock_disponible', 'stock_disponible >= 0')
@Check('CHK_inventario_stock_reservado', 'stock_reservado >= 0')
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

  @ManyToOne(() => Almacen, { eager: true })
  @JoinColumn({ name: 'id_almacen' })
  almacen: Almacen;
}
