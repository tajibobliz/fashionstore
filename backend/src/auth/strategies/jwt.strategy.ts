import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { TenantResolverService } from '../../tenancy/tenant-resolver.service';
import { Role } from '../enums/role.enum';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { TenantContext } from '../../tenancy/tenant-context';
import { Usuario } from '../../users/entities/user.entity';
import { estadoEnCache, guardarEstado } from '../../users/usuarios-activos';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly tenants: TenantResolverService,
    private readonly dataSource: DataSource,
  ) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET no está definido en el .env');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any): Promise<AuthenticatedUser> {
    // `tid` = id de la empresa. Los tokens emitidos antes del SaaS no lo traen:
    // por compatibilidad se asume la empresa por defecto (FashionStore).
    // Un usuario desactivado no puede seguir usando su token (caché de 30 s; ver usuarios-activos).
    if (!(await this.estaActivo(payload.sub)))
      throw new UnauthorizedException('Tu usuario fue desactivado');
    let idEmpresa: number | null = payload.tid ?? null;
    if (payload.tid === undefined && payload.rol !== Role.SUPER_ADMIN) {
      idEmpresa = await this.tenants.defaultTenantId();
    }
    return {
      idUsuario: payload.sub,
      email: payload.email,
      rol: payload.rol,
      idEmpresa,
    };
  }

  private async estaActivo(idUsuario: number) {
    const enCache = estadoEnCache(idUsuario);
    if (enCache !== undefined) return enCache;
    const u = await TenantContext.runAsPlatform(() =>
      this.dataSource.getRepository(Usuario).findOne({
        where: { idUsuario },
        select: { idUsuario: true, estado: true },
      }),
    );
    const activo = !!u?.estado;
    guardarEstado(idUsuario, activo);
    return activo;
  }
}
