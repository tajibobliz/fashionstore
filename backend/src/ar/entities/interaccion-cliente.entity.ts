import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Usuario } from '../../users/entities/user.entity';
import { Producto } from '../../catalog/entities/producto.entity';

export type TipoInteraccion =
  | 'VISUALIZACION'
  | 'BUSQUEDA'
  | 'RESERVA'
  | 'COMPRA'
  | 'PRUEBA_VIRTUAL';

@Entity('interaccion_cliente')
export class InteraccionCliente {
  @PrimaryGeneratedColumn({ name: 'id_interaccion' })
  idInteraccion: number;

  @Column({ length: 30 })
  tipo: TipoInteraccion;

  @CreateDateColumn({ name: 'fecha' })
  fecha: Date;

  @ManyToOne(() => Usuario, { eager: true })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;

  @ManyToOne(() => Producto, { eager: true })
  @JoinColumn({ name: 'id_producto' })
  producto: Producto;
}