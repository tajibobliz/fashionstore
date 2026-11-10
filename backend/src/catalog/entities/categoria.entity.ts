import { TenantOwned } from '../../tenancy/tenant-owned.entity';
import { Entity, PrimaryGeneratedColumn, Column, JoinColumn, ManyToOne, Unique } from 'typeorm';
import type { Relation } from 'typeorm';
import { Sucursal } from '../../branches/entities/sucursal.entity';

@Entity('categoria')
@Unique('UQ_categoria_empresa_sucursal_nombre', ['idEmpresa', 'sucursal', 'nombre'])
export class Categoria extends TenantOwned {
  @PrimaryGeneratedColumn({ name: 'id_categoria' })
  idCategoria: number;

  @Column({ length: 100 })
  nombre: string;

  @Column({ length: 250, nullable: true })
  descripcion: string;

  @ManyToOne(() => Sucursal, { nullable: true })
  @JoinColumn({ name: 'id_sucursal' })
  sucursal: Relation<Sucursal> | null;
}
