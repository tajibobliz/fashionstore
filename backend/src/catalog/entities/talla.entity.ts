import { TenantOwned } from '../../tenancy/tenant-owned.entity';
import { Entity, PrimaryGeneratedColumn, Column, JoinColumn, ManyToOne, Unique } from 'typeorm';
import type { Relation } from 'typeorm';
import { Sucursal } from '../../branches/entities/sucursal.entity';

@Entity('talla')
@Unique('UQ_talla_empresa_sucursal_nombre', ['idEmpresa', 'sucursal', 'nombre'])
export class Talla extends TenantOwned {
  @PrimaryGeneratedColumn({ name: 'id_talla' })
  idTalla: number;

  @Column({ length: 30 })
  nombre: string;

  @ManyToOne(() => Sucursal, { nullable: true })
  @JoinColumn({ name: 'id_sucursal' })
  sucursal: Relation<Sucursal> | null;
}
