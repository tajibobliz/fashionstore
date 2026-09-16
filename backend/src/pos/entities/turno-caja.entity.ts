import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { Caja } from './caja.entity'; import { Usuario } from '../../users/entities/user.entity';
export type EstadoTurno='ABIERTO'|'CERRADO';
@Entity('turno_caja')
export class TurnoCaja {
 @PrimaryGeneratedColumn({name:'id_turno'}) idTurno:number;
 @ManyToOne(()=>Caja,{eager:true}) @JoinColumn({name:'id_caja'}) caja:Relation<Caja>;
 @ManyToOne(()=>Usuario,{eager:true}) @JoinColumn({name:'id_cajero'}) cajero:Relation<Usuario>;
 @CreateDateColumn({name:'fecha_apertura'}) fechaApertura:Date;
 @Column({name:'fecha_cierre',type:'timestamptz',nullable:true}) fechaCierre:Date|null;
 @Column({name:'monto_apertura',type:'numeric',precision:12,scale:2}) montoApertura:number;
 @Column({name:'monto_cierre_declarado',type:'numeric',precision:12,scale:2,nullable:true}) montoCierreDeclarado:number|null;
 @Column({name:'monto_cierre_esperado',type:'numeric',precision:12,scale:2,nullable:true}) montoCierreEsperado:number|null;
 @Column({type:'numeric',precision:12,scale:2,nullable:true}) diferencia:number|null;
 @Column({length:20,default:'ABIERTO'}) estado:EstadoTurno;
}
