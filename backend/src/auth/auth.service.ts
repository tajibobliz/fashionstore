import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { createHash, randomBytes } from 'node:crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RefreshSession } from './entities/refresh-session.entity';
import { ConfigService } from '@nestjs/config';
import { TenantResolverService } from '../tenancy/tenant-resolver.service';
import { TenantContext } from '../tenancy/tenant-context';

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @InjectRepository(RefreshSession)
    private readonly sessions: Repository<RefreshSession>,
    private readonly config: ConfigService,
    private readonly tenants: TenantResolverService,
  ) {}

  /**
   * Valida email + password dentro de una empresa. Devuelve el usuario (sin hash) o null.
   * - Con `empresaSlug`: busca el usuario en esa empresa.
   * - Sin slug: primero un usuario de plataforma (SUPER_ADMIN), luego la empresa por defecto.
   *   Así el login actual de la web y la app sigue funcionando sin cambios.
   */
  async validateUser(
    email: string,
    password: string,
    empresaSlug?: string,
  ): Promise<any> {
    let user;
    if (empresaSlug) {
      const empresa = await this.tenants.findBySlug(empresaSlug);
      if (!empresa) return null;
      user = await this.usersService.findByEmailWithPassword(
        email,
        empresa.idEmpresa,
      );
    } else {
      user =
        (await this.usersService.findByEmailWithPassword(email, null)) ??
        (await this.usersService.findByEmailWithPassword(
          email,
          await this.tenants.defaultTenantId(),
        ));
    }
    if (!user || !user.estado) return null;
    if (user.empresa && user.empresa.estado !== 'ACTIVA') {
      throw new ForbiddenException(
        'La empresa está suspendida. Contacta al administrador de la plataforma.',
      );
    }

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
    await this.sessions.save(
      this.sessions.create({
        userId: user.idUsuario,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + days * 86400000),
      }),
    );
    return this.tokens(user, refreshToken);
  }

  private tokens(user: any, refreshToken: string) {
    const payload = {
      sub: user.idUsuario,
      email: user.email,
      rol: user.rol?.nombre,
      tid: user.idEmpresa ?? null, // tenant: empresa del usuario (null = plataforma)
    };

    return {
      access_token: this.jwtService.sign(payload),
      refresh_token: refreshToken,
      user: {
        idUsuario: user.idUsuario,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol?.nombre,
        idEmpresa: user.idEmpresa ?? null,
        empresa: user.empresa
          ? {
              idEmpresa: user.empresa.idEmpresa,
              nombre: user.empresa.nombre,
              slug: user.empresa.slug,
            }
          : null,
      },
    };
  }

  async refresh(refreshToken: string) {
    // Es público (no hay token de acceso): la empresa sale del propio usuario de la sesión,
    // por eso se busca en modo plataforma (sin filtro por empresa).
    return TenantContext.runAsPlatform(() => this.rotate(refreshToken));
  }

  private async rotate(refreshToken: string) {
    // Bloqueo para que un token solo pueda rotarse una vez, incluso en paralelo.
    return this.sessions.manager.transaction(async (manager) => {
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

  // Registro público: crea un cliente y devuelve los tokens de sesión.
  async register(dto: RegisterDto) {
    // Empresa: la del body (`empresa`), si no la del header X-Tenant / por defecto.
    let idEmpresa: number;
    if (dto.empresa) {
      const empresa = await this.tenants.findBySlug(dto.empresa);
      if (!empresa || empresa.estado !== 'ACTIVA')
        throw new NotFoundException('Tienda no encontrada');
      idEmpresa = empresa.idEmpresa;
    } else {
      idEmpresa = await this.tenants.currentOrDefault();
    }
    // Todo el registro corre en el contexto de esa empresa (RLS permite escribir solo ahí).
    return TenantContext.run({ idEmpresa }, async () => {
      const creado = await this.usersService.create({
        idEmpresa,
        nombre: dto.nombre,
        apellido: dto.apellido,
        email: dto.email,
        password: dto.password,
        telefono: dto.telefono,
        rolNombre: 'CLIENTE', // Registro público crea clientes finales.
      });

      return this.login(await this.usersService.findById(creado.idUsuario));
    });
  }
}
