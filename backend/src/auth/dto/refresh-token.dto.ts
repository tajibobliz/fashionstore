import { IsString, Matches } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @Matches(/^[a-f0-9]{96}$/)
  refresh_token: string;
}
