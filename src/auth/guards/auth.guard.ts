import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { ACCESS_COOKIE } from '../auth.constants.js';
import type { AuthenticatedRequest } from '../auth.types.js';
import { ALLOW_PASSWORD_CHANGE_KEY } from '../decorators/allow-password-change.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { TokenService } from '../token.service.js';
import { readCookie } from '../ws-auth.js';

/**
 * One guard for REST and WebSocket. The access token comes from the
 * `access_token` cookie (for sockets: the handshake's cookie header, which
 * is re-verified on every message, so an expired token stops working).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    if (ctx.getType() === 'ws') {
      const client = ctx.switchToWs().getClient<Socket>();
      const user = await this.tokens.verifyAccessToken(
        readCookie(client.handshake.headers.cookie, ACCESS_COOKIE),
      );
      if (!user) throw new WsException('Unauthorized');
      if (user.mustChangePassword) {
        throw new WsException('Password change required');
      }
      client.data.user = user;
      return true;
    }

    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = await this.tokens.verifyAccessToken(
      req.cookies?.[ACCESS_COOKIE],
    );
    if (!user) throw new UnauthorizedException();
    if (user.mustChangePassword && !this.allowsPasswordChange(ctx)) {
      throw new ForbiddenException('Password change required');
    }
    req.user = user;
    return true;
  }

  private allowsPasswordChange(ctx: ExecutionContext): boolean {
    return !!this.reflector.getAllAndOverride<boolean>(
      ALLOW_PASSWORD_CHANGE_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
  }
}
