import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import type { Relation } from 'typeorm';
import { Sucursal } from '../../branches/entities/sucursal.entity';

@Entity('almacen')
@Unique(['sucursal', 'codigo'])
export class Almacen {
  @PrimaryGeneratedColumn({ name: 'id_almacen' }) idAlmacen: number;
  @ManyToOne(() => Sucursal, { eager: true }) @JoinColumn({ name: 'id_sucursal' }) sucursal: Relation<Sucursal>;
  @Column({ length: 50 }) codigo: string;
  @Column({ length: 120 }) nombre: string;
  @Column({ default: true }) estado: boolean;
}
