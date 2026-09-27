import {
   Check,
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Categoria } from './categoria.entity';
import { Proveedor } from './proveedor.entity';
import { Coleccion } from './coleccion.entity';
import { VarianteProducto } from './variante-producto.entity';
import { Sucursal } from '../../branches/entities/sucursal.entity';

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

  @Column({ name: 'imagen_catalogo_url', type: 'varchar', length: 500, nullable: true })
  imagenCatalogoUrl: string | null;

  @Column({ name: 'recurso_ra_url', length: 500, nullable: true })
  recursoRaUrl: string;

  @Column({ name: 'imagen_try_on', type: 'varchar', length: 500, nullable: true })
  imagenTryOn: string | null;

  @Column({ name: 'imagen_vestidor_url', type: 'varchar', length: 500, nullable: true })
  imagenVestidorUrl: string | null;

  @Column({ name: 'tipo_try_on', type: 'varchar', length: 20, nullable: true })
  tipoTryOn: 'lentes' | 'gorra' | 'polera' | null;

  @Column({ name: 'tipo_prenda_vestidor', type: 'varchar', length: 20, nullable: true })
  tipoPrendaVestidor: 'GORRA' | 'CAMISA' | 'BLUSA' | 'TOP' | 'VESTIDO' | 'FALDA' | 'PANTALON' | 'CARTERA' | 'OTRO' | null;

  @ManyToOne(() => Sucursal, { nullable: true, eager: true })
  @JoinColumn({ name: 'id_sucursal_origen' })
  sucursalOrigen: Relation<Sucursal> | null;

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
  variantes: Relation<VarianteProducto[]>;
}
