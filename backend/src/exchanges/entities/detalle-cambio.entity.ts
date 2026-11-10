import type { Relation } from 'typeorm';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DetalleVenta } from '../../sales/entities/detalle-venta.entity';
import { VarianteProducto } from '../../catalog/entities/variante-producto.entity';
import { Cambio } from './cambio.entity';

/** Una línea del cambio: qué prenda de la venta vuelve y cuál se entrega en su lugar. */
@Entity('detalle_cambio')
export class DetalleCambio {
  @PrimaryGeneratedColumn({ name: 'id_detalle_cambio' })
  idDetalleCambio: number;

  @Column()
  cantidad: number;

  @ManyToOne(() => Cambio, (c) => c.detalles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_cambio' })
  cambio: Relation<Cambio>;

  /** Prenda que la clienta devuelve (línea de la venta original). */
  @ManyToOne(() => DetalleVenta, { eager: true })
  @JoinColumn({ name: 'id_detalle_venta' })
  detalleVenta: Relation<DetalleVenta>;

  /** Prenda que se lleva (puede ser otra talla, otro color u otro producto). */
  @ManyToOne(() => VarianteProducto, { eager: true })
  @JoinColumn({ name: 'id_variante_entregada' })
  varianteEntregada: Relation<VarianteProducto>;

  @Column({ name: 'precio_original', type: 'numeric', precision: 12, scale: 2 })
  precioOriginal: number;

  @Column({ name: 'precio_nuevo', type: 'numeric', precision: 12, scale: 2 })
  precioNuevo: number;
}
