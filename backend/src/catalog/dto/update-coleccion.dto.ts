import { PartialType } from '@nestjs/mapped-types';
import { CreateColeccionDto } from './create-coleccion.dto';
export class UpdateColeccionDto extends PartialType(CreateColeccionDto) {}