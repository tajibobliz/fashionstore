import { TenantOwned } from '../../tenancy/tenant-owned.entity';
import { Entity, PrimaryGeneratedColumn, Column, Unique } from 'typeorm';

@Entity('talla')
@Unique('UQ_talla_empresa_nombre', ['idEmpresa', 'nombre'])
export class Talla extends TenantOwned {
  @PrimaryGeneratedColumn({ name: 'id_talla' })
  idTalla: number;

  @Column({ length: 30 })
  nombre: string;
}