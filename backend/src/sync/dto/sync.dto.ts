import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SyncCatalogQueryDto {
  @ApiProperty({ description: 'Sucursal cuyo stock se descarga' })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  sucursal: number;
}

export class DetalleOperacionDto {
  @IsInt()
  @IsPositive()
  idVariante: number;

  @IsInt()
  @IsPositive()
  cantidad: number;

  /** Precio unitario cobrado en el dispositivo (solo ventas). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precioUnitario?: number;
}

export class PayloadOperacionDto {
  @ApiPropertyOptional({ description: 'Caja del turno (ventas)' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  idCaja?: number;

  @ApiPropertyOptional({
    description: 'Turno abierto en el dispositivo al vender (ventas)',
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  idTurno?: number;

  @ApiPropertyOptional({
    description: 'Cliente registrado de la venta (opcional)',
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  idUsuario?: number;

  @ApiPropertyOptional({ enum: ['MINORISTA', 'MAYORISTA'] })
  @IsOptional()
  @IsIn(['MINORISTA', 'MAYORISTA'])
  modalidadComercial?: 'MINORISTA' | 'MAYORISTA';

  @ApiPropertyOptional({
    enum: ['EFECTIVO', 'TARJETA', 'QR', 'TRANSFERENCIA', 'CONTRAPAGO'],
    description: 'Cómo pagó la clienta (ventas). Por defecto EFECTIVO',
  })
  @IsOptional()
  @IsIn(['EFECTIVO', 'TARJETA', 'QR', 'TRANSFERENCIA', 'CONTRAPAGO'])
  metodoPago?: 'EFECTIVO' | 'TARJETA' | 'QR' | 'TRANSFERENCIA' | 'CONTRAPAGO';

  @ApiPropertyOptional({ description: 'Referencia o comprobante del pago' })
  @IsOptional()
  @IsString()
  @Length(1, 150)
  referenciaPago?: string;

  @ApiPropertyOptional({
    description: 'serverTime del catálogo usado para vender (ISO)',
  })
  @IsOptional()
  @IsDateString()
  catalogoDescargadoEn?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => DetalleOperacionDto)
  detalles: DetalleOperacionDto[];
}

export class OperacionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  operationId: string;

  @ApiProperty({ enum: ['VENTA', 'RESERVA'] })
  @IsIn(['VENTA', 'RESERVA'])
  type: 'VENTA' | 'RESERVA';

  @IsInt()
  @IsPositive()
  idSucursal: number;

  @ApiProperty({
    description: 'Hora del dispositivo al crear la operación (ISO)',
  })
  @IsDateString()
  createdAtLocal: string;

  @ValidateNested()
  @Type(() => PayloadOperacionDto)
  payload: PayloadOperacionDto;
}

export class SyncOperationsDto {
  @ApiProperty({ description: 'Identificador estable del dispositivo' })
  @IsString()
  @Length(3, 100)
  deviceId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OperacionDto)
  operations: OperacionDto[];
}

export class ResolverConflictoDto {
  @ApiProperty({
    description:
      'Qué se hizo para resolverlo (p. ej. "Ajuste de inventario +1")',
  })
  @IsString()
  @Length(3, 300)
  nota: string;
}
