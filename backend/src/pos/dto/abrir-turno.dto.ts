import{IsInt,IsNumber,IsPositive,Min}from'class-validator';export class AbrirTurnoDto{@IsInt()@IsPositive()idCaja:number;@IsNumber()@Min(0)montoApertura:number;}
