import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Categoria } from './categoria.entity';
import { Proveedor } from './proveedor.entity';
import { Coleccion } from './coleccion.entity';

@Entity('producto')
export class Producto {
  @PrimaryGeneratedColumn({ name: 'id_producto' })
  idProducto: number;

  @Column({ length: 150 })
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  precio: number;

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
}