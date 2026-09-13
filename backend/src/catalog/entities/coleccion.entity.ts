import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Temporada } from './temporada.entity';

@Entity('coleccion')
@Unique(['temporada', 'nombre'])
export class Coleccion {
  @PrimaryGeneratedColumn({ name: 'id_coleccion' })
  idColeccion: number;

  @Column({ length: 100 })
  nombre: string;

  @ManyToOne(() => Temporada, { eager: true, nullable: true })
  @JoinColumn({ name: 'id_temporada' })
  temporada: Temporada;
}