import { Entity, PrimaryGeneratedColumn, Column, JoinColumn, ManyToOne } from 'typeorm';
import type { Relation } from 'typeorm';
import { Sucursal } from '../../branches/entities/sucursal.entity';

@Entity('color')
export class Color {
  @PrimaryGeneratedColumn({ name: 'id_color' })
  idColor: number;

  @Column({ length: 50 })
  nombre: string;

  @Column({ name: 'codigo_hex', length: 10, nullable: true })
  codigoHex: string;

  @ManyToOne(() => Sucursal, { nullable: true })
  @JoinColumn({ name: 'id_sucursal' })
  sucursal: Relation<Sucursal> | null;
}
