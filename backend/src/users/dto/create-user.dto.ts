import { IsEnum } from 'class-validator';
import { RegisterDto } from '../../auth/dto/register.dto';
import { Role } from '../../auth/enums/role.enum';

export class CreateUserDto extends RegisterDto {
  @IsEnum(Role)
  rolNombre: Role;
}
