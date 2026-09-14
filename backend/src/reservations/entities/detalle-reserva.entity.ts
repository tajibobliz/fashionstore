import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Reserva } from './reserva.entity';
import { VarianteProducto } from '../../catalog/entities/variante-producto.entity';

@Entity('detalle_reserva')
export class DetalleReserva {
  @PrimaryGeneratedColumn({ name: 'id_detalle_reserva' })
  idDetalleReserva: number;

  @Column()
  cantidad: number;

  @ManyToOne(() => Reserva, (reserva) => reserva.detalles, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'id_reserva' })
  reserva: Reserva;

  @ManyToOne(() => VarianteProducto, { eager: true })
  @JoinColumn({ name: 'id_variante' })
  variante: VarianteProducto;
}