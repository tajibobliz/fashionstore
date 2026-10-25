import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantResolverService } from '../../tenancy/tenant-resolver.service';
import { Role } from '../enums/role.enum';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly tenants: TenantResolverService,
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
}
