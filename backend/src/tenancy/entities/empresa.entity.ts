import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type EstadoEmpresa = 'ACTIVA' | 'SUSPENDIDA';

/**
 * Empresa contratante = TENANT.
 * Todo dato de negocio (sucursales, catálogo, ventas…) pertenece a una empresa
 * mediante la columna `id_empresa`. Una sucursal no es un tenant.
 */
@Entity('empresa')
export class Empresa {
  @PrimaryGeneratedColumn({ name: 'id_empresa' })
  idEmpresa: number;

  @Column({ length: 150 })
  nombre: string;

  /** Identificador corto usado en la URL pública: /t/:slug */
  @Column({ length: 60, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  nit: string | null;

  @Column({ length: 20, default: 'ACTIVA' })
  estado: EstadoEmpresa;

  /** Días que tiene un cliente para cambiar una prenda. */
  @Column({ name: 'plazo_cambio_dias', type: 'integer', default: 7 })
  plazoCambioDias: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
