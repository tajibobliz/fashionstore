import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Producto } from '../../catalog/entities/producto.entity';
import { Categoria } from '../../catalog/entities/categoria.entity';
import { Temporada } from '../../catalog/entities/temporada.entity';

@Entity('promocion')
export class Promocion {
  @PrimaryGeneratedColumn({ name: 'id_promocion' })
  idPromocion: number;

  @Column({ length: 120 })
  nombre: string;

  @Column({ type: 'numeric', precision: 5, scale: 2 })
  porcentaje: number;

  @Column({ name: 'fecha_inicio', type: 'date', nullable: true })
  fechaInicio: Date;

  @Column({ name: 'fecha_fin', type: 'date', nullable: true })
  fechaFin: Date;

  @Column({ default: true })
  estado: boolean;

  @ManyToMany(() => Producto, { eager: true })
  @JoinTable({
    name: 'promocion_producto',
    joinColumn: { name: 'id_promocion', referencedColumnName: 'idPromocion' },
    inverseJoinColumn: { name: 'id_producto', referencedColumnName: 'idProducto' },
  })
  productos: Producto[];

  @ManyToMany(() => Categoria, { eager: true })
  @JoinTable({ name: 'promocion_categoria', joinColumn: { name: 'id_promocion', referencedColumnName: 'idPromocion' }, inverseJoinColumn: { name: 'id_categoria', referencedColumnName: 'idCategoria' } })
  categorias: Categoria[];

  @ManyToMany(() => Temporada, { eager: true })
  @JoinTable({ name: 'promocion_temporada', joinColumn: { name: 'id_promocion', referencedColumnName: 'idPromocion' }, inverseJoinColumn: { name: 'id_temporada', referencedColumnName: 'idTemporada' } })
  temporadas: Temporada[];
}
