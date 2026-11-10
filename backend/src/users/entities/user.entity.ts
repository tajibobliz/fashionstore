import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Empresa } from '../../tenancy/entities/empresa.entity';
import { Rol } from './rol.entity';

@Entity('usuario')
// El email es único dentro de cada empresa: la misma persona puede ser clienta de dos empresas.
@Unique('UQ_usuario_empresa_email', ['idEmpresa', 'email'])
// Usuarios de plataforma (SUPER_ADMIN, sin empresa): email único entre ellos.
@Index('UQ_usuario_email_plataforma', ['email'], { unique: true, where: 'id_empresa IS NULL' })
export class Usuario {
  @PrimaryGeneratedColumn({ name: 'id_usuario' })
  idUsuario: number;

  @Column({ length: 100 })
  nombre: string;

  @Column({ length: 100, nullable: true })
  apellido: string;

  @Column({ length: 150 })
  email: string;

  @Column({ name: 'password_hash', length: 255, select: false })
  passwordHash: string;

  @Column({ length: 30, nullable: true })
  telefono: string;

  @Column({ name: 'push_token', length: 255, nullable: true })
  pushToken: string;

  @Column({ default: true })
  estado: boolean;

  @CreateDateColumn({ name: 'fecha_registro' })
  fechaRegistro: Date;

  /** Empresa (tenant) a la que pertenece. NULL solo para SUPER_ADMIN. */
  @Index()
  @Column({ name: 'id_empresa', type: 'integer', nullable: true })
  idEmpresa: number | null;

  @ManyToOne(() => Empresa, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_empresa' })
  empresa?: Relation<Empresa> | null;

  // Relación: muchos usuarios pertenecen a un rol
  @ManyToOne(() => Rol, (rol) => rol.usuarios, { eager: true })
  @JoinColumn({ name: 'id_rol' })
  rol: Rol;
}
