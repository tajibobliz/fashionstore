import type { Relation } from 'typeorm';
import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Sucursal } from './sucursal.entity';

@Entity('ciudad')
export class Ciudad {
  @PrimaryGeneratedColumn({ name: 'id_ciudad' })
  idCiudad: number;

  @Column({ length: 100 })
  nombre: string;

  @OneToMany(() => Sucursal, (sucursal) => sucursal.ciudad)
  sucursales: Relation<Sucursal[]>;
}
