import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('temporada')
export class Temporada {
  @PrimaryGeneratedColumn({ name: 'id_temporada' })
  idTemporada: number;

  @Column({ length: 100 })
  nombre: string;

  @Column({ name: 'fecha_inicio', type: 'date', nullable: true })
  fechaInicio: Date;

  @Column({ name: 'fecha_fin', type: 'date', nullable: true })
  fechaFin: Date;
}