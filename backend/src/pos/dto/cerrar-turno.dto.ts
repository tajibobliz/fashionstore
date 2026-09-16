import{IsNumber,Min}from'class-validator';export class CerrarTurnoDto{@IsNumber()@Min(0)montoCierreDeclarado:number;}
