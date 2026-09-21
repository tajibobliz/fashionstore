import {
   Check,
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Categoria } from './categoria.entity';
import { Proveedor } from './proveedor.entity';
import { Coleccion } from './coleccion.entity';
import { VarianteProducto } from './variante-producto.entity';

@Entity('producto')
@Check('CHK_producto_precio_mayorista', 'precio_mayorista IS NULL OR precio_mayorista >= 0')
@Check('CHK_producto_cantidad_minima_mayorista', 'cantidad_minima_mayorista IS NULL OR cantidad_minima_mayorista > 0')
export class Producto {
  @PrimaryGeneratedColumn({ name: 'id_producto' })
  idProducto: number;

  @Column({ length: 150 })
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  precio: number;

  @Column({ name: 'precio_mayorista', type: 'numeric', precision: 12, scale: 2, nullable: true })
  precioMayorista: number | null;

  @Column({ name: 'cantidad_minima_mayorista', type: 'integer', nullable: true })
  cantidadMinimaMayorista: number | null;

  @Column({ name: 'imagen_url', length: 500, nullable: true })
  imagenUrl: string;

  @Column({ name: 'recurso_ra_url', length: 500, nullable: true })
  recursoRaUrl: string;

  @Column({ default: true })
  estado: boolean;

  @ManyToOne(() => Categoria, { eager: true })
  @JoinColumn({ name: 'id_categoria' })
  categoria: Categoria;

  @ManyToOne(() => Proveedor, { eager: true, nullable: true })
  @JoinColumn({ name: 'id_proveedor' })
  proveedor: Proveedor;

  @ManyToOne(() => Coleccion, { eager: true, nullable: true })
  @JoinColumn({ name: 'id_coleccion' })
  coleccion: Coleccion;

  @OneToMany(() => VarianteProducto, (v) => v.producto)
  variantes: VarianteProducto[];
}
