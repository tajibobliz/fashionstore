import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DetalleCambioDto {
  @ApiProperty({
    description: 'Línea de la venta original que la clienta devuelve',
  })
  @IsInt()
  @IsPositive()
  idDetalleVenta: number;

  @IsInt()
  @IsPositive()
  cantidad: number;

  @ApiProperty({ description: 'Variante que se entrega en su lugar' })
  @IsInt()
  @IsPositive()
  idVarianteNueva: number;
}

export class CreateCambioDto {
  @IsInt()
  @IsPositive()
  idVenta: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  motivo?: string;

  @ApiPropertyOptional({
    enum: ['EFECTIVO', 'TARJETA', 'QR', 'TRANSFERENCIA'],
    description:
      'Obligatorio si la prenda nueva cuesta más (la clienta paga la diferencia)',
  })
  @IsOptional()
  @IsIn(['EFECTIVO', 'TARJETA', 'QR', 'TRANSFERENCIA'])
  metodoPagoDiferencia?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DetalleCambioDto)
  detalles: DetalleCambioDto[];
}

export class PoliticaCambioDto {
  @ApiProperty({
    description:
      'Días desde la venta en que se aceptan cambios (0 = no se aceptan)',
  })
  @IsInt()
  @Min(0)
  @Max(90)
  plazoCambioDias: number;
}
