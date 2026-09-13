import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  // Valida email + password contra la BD. Devuelve el usuario (sin hash) o null.
  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (!user) return null;

    const passwordValido = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValido) return null;

    // Excluimos el passwordHash de lo que devolvemos
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  // Genera el JWT con los datos clave del usuario.
  async login(user: any) {
    const payload = {
      sub: user.idUsuario,
      email: user.email,
      rol: user.rol?.nombre,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        idUsuario: user.idUsuario,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol?.nombre,
      },
    };
  }

  // Registra un cliente nuevo y devuelve el JWT directamente (login automático).
  async register(dto: RegisterDto) {
    const nuevo = await this.usersService.create({
      nombre: dto.nombre,
      apellido: dto.apellido,
      email: dto.email,
      password: dto.password,
      telefono: dto.telefono,
      rolNombre: 'CLIENTE', // registro público siempre es cliente
    });

    return this.login(nuevo);
  }
}