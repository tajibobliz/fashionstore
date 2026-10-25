import { TenantOwned } from '../../tenancy/tenant-owned.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Producto } from './producto.entity';
import { Talla } from './talla.entity';
import { Color } from './color.entity';

@Entity('variante_producto')
@Unique('UQ_variante_empresa_sku', ['idEmpresa', 'sku'])
@Unique(['producto', 'talla', 'color'])
export class VarianteProducto extends TenantOwned {
  @PrimaryGeneratedColumn({ name: 'id_variante' })
  idVariante: number;

  @Column({ length: 80 })
  sku: string;

  @ManyToOne(() => Producto, { eager: true })
  @JoinColumn({ name: 'id_producto' })
  producto: Producto;

  @ManyToOne(() => Talla, { eager: true, nullable: true })
  @JoinColumn({ name: 'id_talla' })
  talla: Talla;

  @ManyToOne(() => Color, { eager: true, nullable: true })
  @JoinColumn({ name: 'id_color' })
  color: Color;
}