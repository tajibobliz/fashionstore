import { IsBoolean, IsInt, IsOptional, IsString, Max, Min, Matches } from 'class-validator';

export class CreateImagenVarianteDto {
  @IsString()
  @Matches(/^https?:\/\/[^?#]+\.(?:jpe?g|png|webp)(?:[?#].*)?$/i, { message: 'url debe ser una imagen JPG, JPEG, PNG o WebP' })
  url: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  orden?: number;

  @IsOptional()
  @IsBoolean()
  principal?: boolean;
}
