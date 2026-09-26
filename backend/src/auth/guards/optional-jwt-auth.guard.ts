import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Valida JWT cuando se envía y permite continuar como invitado cuando no hay sesión. */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(_error: unknown, user: TUser): TUser {
    return (user ?? null) as TUser;
  }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
