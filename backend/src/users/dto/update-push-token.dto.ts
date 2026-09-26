import { IsNotEmpty, IsString } from 'class-validator';

export class UpdatePushTokenDto {
  @IsString()
  @IsNotEmpty({ message: 'El token es obligatorio' })
  token: string;
}
