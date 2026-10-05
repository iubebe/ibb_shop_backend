import { Inject, Injectable } from '@nestjs/common';
import type { Socket } from 'socket.io';
import { ACCESS_COOKIE, AUTH_CONFIG } from './auth.constants.js';
import type { AuthConfig } from './auth.config.js';
import { TokenService } from './token.service.js';
import { readCookie } from './ws-auth.js';

/**
 * Socket.IO handshake middleware: rejects the connection unless the Origin
 * is allowed (WebSockets ignore CORS) and the access cookie is valid.
 * Register with `server.use(wsAuth.middleware())` in the gateway's `afterInit`.
 */
@Injectable()
export class WsAuthMiddleware {
  constructor(
    private readonly tokens: TokenService,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  middleware() {
    return async (socket: Socket, next: (err?: Error) => void) => {
      const { origin, cookie } = socket.handshake.headers;
      if (origin && !this.config.allowedOrigins.includes(origin)) {
        return next(new Error('Origin not allowed'));
      }
      const user = await this.tokens.verifyAccessToken(
        readCookie(cookie, ACCESS_COOKIE),
      );
      if (!user) return next(new Error('Unauthorized'));
      socket.data.user = user;
      next();
    };
  }
}
