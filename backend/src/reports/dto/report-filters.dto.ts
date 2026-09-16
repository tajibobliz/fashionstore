import { Transform, Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ReportFiltersDto {
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsDateString() desde?: string;
  @ApiPropertyOptional({ format: 'date-time' }) @IsOptional() @IsDateString() hasta?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) idSucursal?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) idAlmacen?: number;
  @ApiPropertyOptional({ enum: ['DIGITAL', 'PRESENCIAL'] }) @IsOptional() @IsIn(['DIGITAL', 'PRESENCIAL']) tipoVenta?: string;
  @ApiPropertyOptional({ enum: ['MINORISTA', 'MAYORISTA'] }) @IsOptional() @IsIn(['MINORISTA', 'MAYORISTA']) modalidadComercial?: string;
  @ApiPropertyOptional({ enum: ['EFECTIVO', 'TARJETA', 'QR', 'TRANSFERENCIA', 'CONTRAPAGO'] })
  @IsOptional() @IsIn(['EFECTIVO', 'TARJETA', 'QR', 'TRANSFERENCIA', 'CONTRAPAGO']) metodoPago?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) idCajero?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) idCaja?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) idTurno?: number;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @ApiPropertyOptional({ default: 20, maximum: 100 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}

export class InventoryReportFiltersDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) idSucursal?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) idAlmacen?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) idCategoria?: number;
  @IsOptional() @Transform(({ value }) => value === true || value === 'true') stockCritico?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) threshold = 5;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}

export class ReservationReportFiltersDto {
  @IsOptional() @IsDateString() desde?: string;
  @IsOptional() @IsDateString() hasta?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) idSucursal?: number;
  @IsOptional() @IsIn(['PENDIENTE', 'PREPARADA', 'ATENDIDA', 'CANCELADA']) estado?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}

export class TurnReportFiltersDto {
  @IsOptional() @IsDateString() desde?: string;
  @IsOptional() @IsDateString() hasta?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) idSucursal?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) idCaja?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) idCajero?: number;
  @IsOptional() @IsIn(['ABIERTO', 'CERRADO']) estadoTurno?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}
