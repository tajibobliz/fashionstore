import { Entity, PrimaryGeneratedColumn, Column, JoinColumn, ManyToOne } from 'typeorm';
import type { Relation } from 'typeorm';
import { Sucursal } from '../../branches/entities/sucursal.entity';

@Entity('talla')
export class Talla {
  @PrimaryGeneratedColumn({ name: 'id_talla' })
  idTalla: number;

  @Column({ length: 30, unique: true })
  nombre: string;

  @ManyToOne(() => Sucursal, { nullable: true })
  @JoinColumn({ name: 'id_sucursal' })
  sucursal: Relation<Sucursal> | null;
}
