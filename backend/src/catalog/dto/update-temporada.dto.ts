import { PartialType } from '@nestjs/mapped-types';
import { CreateTemporadaDto } from './create-temporada.dto';
export class UpdateTemporadaDto extends PartialType(CreateTemporadaDto) {}