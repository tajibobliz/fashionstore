import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Usuario } from './user.entity';

@Entity('rol')
export class Rol {
  @PrimaryGeneratedColumn({ name: 'id_rol' })
  idRol: number;

  @Column({ length: 50, unique: true })
  nombre: string;

  @Column({ length: 200, nullable: true })
  descripcion: string;

  // Relación: un rol tiene muchos usuarios
  @OneToMany(() => Usuario, (usuario) => usuario.rol)
  usuarios: Usuario[];
}