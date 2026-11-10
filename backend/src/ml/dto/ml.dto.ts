import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class DemandaQueryDto {
  @ApiPropertyOptional({ default: 4, minimum: 1, maximum: 12, description: 'Semanas a pronosticar' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12)
  semanas = 4;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  idSucursal?: number;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  idProducto?: number;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 50 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  top = 10;
}

export class AnomaliasQueryDto {
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  idSucursal?: number;
}
