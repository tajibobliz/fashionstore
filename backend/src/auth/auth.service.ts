import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { createHash, randomBytes } from 'node:crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RefreshSession } from './entities/refresh-session.entity';
import { ConfigService } from '@nestjs/config';

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @InjectRepository(RefreshSession)
    private readonly sessions: Repository<RefreshSession>,
    private readonly config: ConfigService,
  ) {}

  // Valida email + password contra la BD. Devuelve el usuario (sin hash) o null.
  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.estado) return null;

    const passwordValido = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValido) return null;

    // Excluimos el passwordHash de lo que devolvemos
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
  }

  // Genera el JWT con los datos clave del usuario.
  async login(user: any) {
    const days = Number(this.config.get('REFRESH_TOKEN_TTL_DAYS') ?? 7);
    if (!Number.isFinite(days) || days <= 0 || days > 90) {
      throw new Error('REFRESH_TOKEN_TTL_DAYS debe estar entre 0 y 90');
    }
    const refreshToken = randomBytes(48).toString('hex');
    await this.sessions.save(this.sessions.create({
      userId: user.idUsuario,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + days * 86400000),
    }));
    return this.tokens(user, refreshToken);
  }

  private tokens(user: any, refreshToken: string) {
    const payload = {
      sub: user.idUsuario,
      email: user.email,
      rol: user.rol?.nombre,
    };

    return {
      access_token: this.jwtService.sign(payload),
      refresh_token: refreshToken,
      user: {
        idUsuario: user.idUsuario,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol?.nombre,
      },
    };
  }

  async refresh(refreshToken: string) {
    // Bloqueo para que un token solo pueda rotarse una vez, incluso en paralelo.
    return this.sessions.manager.transaction(async manager => {
      const repo = manager.getRepository(RefreshSession);
      const session = await repo.findOne({
        where: { tokenHash: hashToken(refreshToken) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!session || session.expiresAt.getTime() <= Date.now()) {
        throw new UnauthorizedException('Refresh token inválido o expirado');
      }
      const user = await this.usersService.findById(session.userId);
      if (!user.estado) throw new UnauthorizedException('Usuario inactivo');
      const nextToken = randomBytes(48).toString('hex');
      session.tokenHash = hashToken(nextToken);
      await repo.save(session);
      return this.tokens(user, nextToken);
    });
  }

  async logout(refreshToken: string) {
    await this.sessions.delete({ tokenHash: hashToken(refreshToken) });
    return { message: 'Sesión cerrada' };
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
