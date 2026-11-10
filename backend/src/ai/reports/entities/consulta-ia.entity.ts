import type { Relation } from 'typeorm';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TenantOwned } from '../../../tenancy/tenant-owned.entity';
import { Usuario } from '../../../users/entities/user.entity';

export type EstadoConsultaIa = 'OK' | 'ACLARACION' | 'SIN_REPORTE' | 'ERROR';

/** Una herramienta que pidió el modelo y qué pasó con ella (para auditoría). */
export interface HerramientaRegistrada {
  nombre: string;
  entrada: Record<string, unknown>;
  ok: boolean;
  error?: string;
  filas?: number;
}

/**
 * Bitácora de reportes con IA (Fase 3, tarea 3.1): qué preguntó cada usuario, qué
 * herramientas usó el modelo con qué parámetros, cuántos tokens costó y cuánto tardó.
 * No guarda los datos del reporte (se recalculan), solo lo necesario para auditar.
 */
@Entity('consulta_ia')
@Index('IDX_consulta_ia_usuario_fecha', ['usuario', 'creadaEn'])
export class ConsultaIa extends TenantOwned {
  @PrimaryGeneratedColumn({ name: 'id_consulta_ia' })
  idConsultaIa: number;

  @ManyToOne(() => Usuario, { eager: false })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Relation<Usuario>;

  @Column({ type: 'varchar', length: 500 })
  consulta: string;

  @Column({ type: 'varchar', length: 20 })
  estado: EstadoConsultaIa;

  @Column({ type: 'varchar', length: 30 })
  proveedor: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  modelo: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  herramientas: HerramientaRegistrada[];

  @Column({ type: 'smallint', default: 0 })
  iteraciones: number;

  @Column({ name: 'tokens_entrada', type: 'integer', default: 0 })
  tokensEntrada: number;

  @Column({ name: 'tokens_salida', type: 'integer', default: 0 })
  tokensSalida: number;

  @Column({ name: 'duracion_ms', type: 'integer', default: 0 })
  duracionMs: number;

  @Column({ type: 'varchar', length: 300, nullable: true })
  error: string | null;

  @CreateDateColumn({ name: 'creada_en', type: 'timestamptz' })
  creadaEn: Date;
}
