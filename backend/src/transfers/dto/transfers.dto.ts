import {
  ArrayMaxSize,
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
import { ESTADOS_TRASPASO } from '../entities/traspaso.entity';

export class LineaTraspasoDto {
  @IsInt()
  @IsPositive()
  idVariante: number;

  @IsInt()
  @Min(1)
  @Max(10000)
  cantidad: number;
}

export class CreateTraspasoDto {
  @IsInt()
  @IsPositive()
  idSucursalOrigen: number;

  @IsInt()
  @IsPositive()
  idSucursalDestino: number;

  @ApiProperty({ type: [LineaTraspasoDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => LineaTraspasoDto)
  detalles: LineaTraspasoDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  observacion?: string;
}

export class LineaRecepcionDto {
  @IsInt()
  @IsPositive()
  idDetalleTraspaso: number;

  @ApiProperty({
    description:
      'Unidades que llegaron en buen estado (0 = rechazo total de la línea)',
  })
  @IsInt()
  @Min(0)
  cantidadRecibida: number;
}

export class RecibirTraspasoDto {
  @ApiProperty({ type: [LineaRecepcionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineaRecepcionDto)
  detalles: LineaRecepcionDto[];

  @ApiPropertyOptional({
    description:
      'Obligatoria si llegó menos de lo enviado (motivo de la merma)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  observacion?: string;
}

export class CancelarTraspasoDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  motivo?: string;
}

export class ListarTraspasosDto {
  @IsOptional()
  @IsIn(ESTADOS_TRASPASO)
  estado?: string;
}

export class StockQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;
}
