import { PartialType } from '@nestjs/mapped-types';
import { CreateVarianteDto } from './create-variante.dto';
export class UpdateVarianteDto extends PartialType(CreateVarianteDto) {}