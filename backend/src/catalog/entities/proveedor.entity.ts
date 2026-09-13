import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('proveedor')
export class Proveedor {
  @PrimaryGeneratedColumn({ name: 'id_proveedor' })
  idProveedor: number;

  @Column({ length: 150 })
  nombre: string;

  @Column({ length: 30, nullable: true })
  nit: string;

  @Column({ length: 30, nullable: true })
  telefono: string;

  @Column({ length: 150, nullable: true })
  email: string;

  @Column({ default: true })
  estado: boolean;
}