import { IsBoolean, IsInt, IsOptional, IsUrl, Max, Min } from 'class-validator';

export class CreateImagenVarianteDto {
  @IsUrl({ require_tld: false })
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
