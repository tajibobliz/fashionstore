import type { Relation } from 'typeorm';
import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { VarianteProducto } from '../../catalog/entities/variante-producto.entity';
import { Traspaso } from './traspaso.entity';

/**
 * Una prenda (variante) del traspaso. Al recibir se anota cuánto llegó; la diferencia
 * con lo enviado es la merma (RN-013: enviado = recibido + merma, nada se pierde sin registro).
 */
@Entity('detalle_traspaso')
@Check('CHK_detalle_traspaso_enviada', 'cantidad_enviada > 0')
@Check(
  'CHK_detalle_traspaso_recibida',
  'cantidad_recibida IS NULL OR (cantidad_recibida >= 0 AND cantidad_recibida <= cantidad_enviada)',
)
export class DetalleTraspaso {
  @PrimaryGeneratedColumn({ name: 'id_detalle_traspaso' })
  idDetalleTraspaso: number;

  @ManyToOne(() => Traspaso, (t) => t.detalles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_traspaso' })
  traspaso: Relation<Traspaso>;

  @ManyToOne(() => VarianteProducto, { eager: true })
  @JoinColumn({ name: 'id_variante' })
  variante: Relation<VarianteProducto>;

  @Column({ name: 'cantidad_enviada' })
  cantidadEnviada: number;

  /** null mientras está en tránsito. */
  @Column({ name: 'cantidad_recibida', type: 'integer', nullable: true })
  cantidadRecibida: number | null;
}
