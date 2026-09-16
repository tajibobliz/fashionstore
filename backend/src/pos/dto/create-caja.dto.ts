import { IsBoolean,IsInt,IsNotEmpty,IsOptional,IsPositive,IsString,MaxLength } from 'class-validator';
export class CreateCajaDto {@IsInt()@IsPositive()idSucursal:number;@IsOptional()@IsInt()@IsPositive()idAlmacenDefault?:number;@IsString()@IsNotEmpty()@MaxLength(50)codigo:string;@IsString()@IsNotEmpty()@MaxLength(120)nombre:string;@IsOptional()@IsBoolean()estado?:boolean;}
