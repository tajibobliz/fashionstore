import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('color')
export class Color {
  @PrimaryGeneratedColumn({ name: 'id_color' })
  idColor: number;

  @Column({ length: 50 })
  nombre: string;

  @Column({ name: 'codigo_hex', length: 10, nullable: true })
  codigoHex: string;
}