import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('talla')
export class Talla {
  @PrimaryGeneratedColumn({ name: 'id_talla' })
  idTalla: number;

  @Column({ length: 30, unique: true })
  nombre: string;
}