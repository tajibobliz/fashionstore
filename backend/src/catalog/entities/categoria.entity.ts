import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('categoria')
export class Categoria {
  @PrimaryGeneratedColumn({ name: 'id_categoria' })
  idCategoria: number;

  @Column({ length: 100, unique: true })
  nombre: string;

  @Column({ length: 250, nullable: true })
  descripcion: string;
}