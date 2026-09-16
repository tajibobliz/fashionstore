import type { Relation } from 'typeorm';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Ciudad } from './ciudad.entity';

@Entity('sucursal')
@Unique(['ciudad', 'nombre'])
export class Sucursal {
  @PrimaryGeneratedColumn({ name: 'id_sucursal' })
  idSucursal: number;

  @Column({ length: 120 })
  nombre: string;

  @Column({ length: 250 })
  direccion: string;

  @Column({ length: 30, nullable: true })
  telefono: string;

  @Column({ default: true })
  estado: boolean;

  @ManyToOne(() => Ciudad, (ciudad) => ciudad.sucursales, { eager: true })
  @JoinColumn({ name: 'id_ciudad' })
  ciudad: Relation<Ciudad>;
}
