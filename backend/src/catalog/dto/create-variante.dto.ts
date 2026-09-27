import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateVarianteDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  idSucursal?: number;
  @IsInt()
  @IsPositive()
  idProducto: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  idTalla?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  idColor?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  sku: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(/^$|^(?:https?:\/\/[^?#]+\.(?:png|webp)(?:[?#].*)?|\/uploads\/tryon\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png)$/i, { message: 'imagenVestidorUrl debe ser PNG o WebP externo, o un PNG local de vestidor' })
  imagenVestidorUrl?: string | null;
}
