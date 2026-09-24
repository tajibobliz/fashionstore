import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import type { Relation } from 'typeorm';
import { VarianteProducto } from './variante-producto.entity';

@Entity('imagen_variante')
@Unique(['variante', 'orden'])
export class ImagenVariante {
  @PrimaryGeneratedColumn({ name: 'id_imagen' })
  idImagen: number;

  @ManyToOne(() => VarianteProducto, (variante) => variante.imagenes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_variante' })
  variante: Relation<VarianteProducto>;

  @Column({ length: 500 })
  url: string;

  @Column({ type: 'smallint' })
  orden: number;

  @Column({ default: false })
  principal: boolean;
}
