import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';

export class TurnoHistorialDto {
  @ApiProperty({ enum: ['usuario', 'asistente'] })
  @IsIn(['usuario', 'asistente'])
  rol: 'usuario' | 'asistente';

  @IsString()
  @Length(1, 1000)
  texto: string;
}

export class ConsultaReporteDto {
  @ApiProperty({ example: '¿Cuáles fueron los 5 productos más vendidos este mes?' })
  @IsString()
  @Length(3, 500)
  consulta: string;

  @ApiPropertyOptional({
    type: [TurnoHistorialDto],
    description: 'Turnos anteriores (máx. 6) para preguntas de seguimiento o responder una aclaración.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => TurnoHistorialDto)
  historial?: TurnoHistorialDto[];
}
