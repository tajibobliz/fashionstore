import { IsIn, IsInt, IsOptional, IsPositive, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVentaCarritoDto {
  @IsInt()
  @IsPositive()
  idSucursal: number;

  @IsOptional()
  @ApiPropertyOptional({ enum: ['MINORISTA', 'MAYORISTA'], default: 'MINORISTA' })
  @IsIn(['MINORISTA', 'MAYORISTA'])
  modalidadComercial?: 'MINORISTA' | 'MAYORISTA';

  /** UUID generado por el cliente para permitir reintentos seguros. */
  @ApiPropertyOptional({ format: 'uuid', description: 'UUID generado por el cliente para reintentos seguros' })
  @IsOptional()
  @IsUUID()
  clientRequestId?: string;
}
