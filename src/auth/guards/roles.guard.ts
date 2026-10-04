import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WsException } from '@nestjs/websockets';
import { getAuthUser } from '../auth-context.js';
import type { UserRole } from '../../database/enums.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

/** Runs after `AuthGuard`. No `@Roles()` means any signed-in user. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!roles?.length) return true;
    const user = getAuthUser(ctx);
    if (user && roles.includes(user.role)) return true;
    throw ctx.getType() === 'ws'
      ? new WsException('Forbidden')
      : new ForbiddenException();
  }
}
