import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Devolucion } from './devolucion.entity';
import { DetalleVenta } from '../../sales/entities/detalle-venta.entity';

@Entity('detalle_devolucion')
export class DetalleDevolucion {
  @PrimaryGeneratedColumn({ name: 'id_detalle_devolucion' })
  idDetalleDevolucion: number;

  @Column()
  cantidad: number;

  @ManyToOne(() => Devolucion, (dev) => dev.detalles, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'id_devolucion' })
  devolucion: Devolucion;

  @ManyToOne(() => DetalleVenta, { eager: true })
  @JoinColumn({ name: 'id_detalle_venta' })
  detalleVenta: DetalleVenta;
}