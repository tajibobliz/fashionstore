import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import type { Relation } from 'typeorm';
import { Sucursal } from '../../branches/entities/sucursal.entity';
import { Almacen } from '../../warehouses/entities/almacen.entity';
@Entity('caja') @Unique(['sucursal','codigo'])
export class Caja {
 @PrimaryGeneratedColumn({name:'id_caja'}) idCaja:number;
 @ManyToOne(()=>Sucursal,{eager:true}) @JoinColumn({name:'id_sucursal'}) sucursal:Relation<Sucursal>;
 @ManyToOne(()=>Almacen,{eager:true,nullable:true}) @JoinColumn({name:'id_almacen_default'}) almacenDefault:Relation<Almacen>|null;
 @Column({length:50}) codigo:string; @Column({length:120}) nombre:string; @Column({default:true}) estado:boolean;
}
