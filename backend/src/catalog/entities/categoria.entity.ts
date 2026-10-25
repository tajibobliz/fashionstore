import { TenantOwned } from '../../tenancy/tenant-owned.entity';
import { Entity, PrimaryGeneratedColumn, Column, Unique } from 'typeorm';

@Entity('categoria')
@Unique('UQ_categoria_empresa_nombre', ['idEmpresa', 'nombre'])
export class Categoria extends TenantOwned {
  @PrimaryGeneratedColumn({ name: 'id_categoria' })
  idCategoria: number;

  @Column({ length: 100 })
  nombre: string;

  @Column({ length: 250, nullable: true })
  descripcion: string;
}