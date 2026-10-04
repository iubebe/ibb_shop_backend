import type { ExecutionContext } from '@nestjs/common';
import type { Socket } from 'socket.io';
import type { AuthUser, AuthenticatedRequest } from './auth.types.js';

export function getAuthUser(ctx: ExecutionContext): AuthUser | undefined {
  if (ctx.getType() === 'ws') {
    return ctx.switchToWs().getClient<Socket>().data.user as
      AuthUser | undefined;
  }
  return ctx.switchToHttp().getRequest<AuthenticatedRequest>().user;
}
