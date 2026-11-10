import { Column, Index, JoinColumn, ManyToOne } from 'typeorm';
import type { Relation } from 'typeorm';
import { Empresa } from './entities/empresa.entity';

/**
 * Clase base para toda entidad que pertenece a un tenant (empresa).
 * Agrega la columna `id_empresa` (FK a empresa) con índice.
 *
 * - Al insertar, `TenantSubscriber` completa `idEmpresa` automáticamente.
 * - Al leer, cada servicio debe filtrar por `idEmpresa` (Fase 1, paso 5).
 */
export abstract class TenantOwned {
  @Index()
  @Column({ name: 'id_empresa', type: 'integer' })
  idEmpresa: number;

  @ManyToOne(() => Empresa, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_empresa' })
  empresa?: Relation<Empresa>;
}
