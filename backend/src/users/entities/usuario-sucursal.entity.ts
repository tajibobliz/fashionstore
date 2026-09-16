import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import type { Relation } from 'typeorm';
import { Usuario } from './user.entity';
import { Sucursal } from '../../branches/entities/sucursal.entity';

@Entity('usuario_sucursal')
@Unique(['usuario', 'sucursal'])
export class UsuarioSucursal {
  @PrimaryGeneratedColumn({ name: 'id_usuario_sucursal' }) idUsuarioSucursal: number;
  @ManyToOne(() => Usuario, { eager: true }) @JoinColumn({ name: 'id_usuario' }) usuario: Relation<Usuario>;
  @ManyToOne(() => Sucursal, { eager: true }) @JoinColumn({ name: 'id_sucursal' }) sucursal: Relation<Sucursal>;
  @Column({ default: true }) estado: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
