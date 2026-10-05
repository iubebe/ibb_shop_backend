import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayInit,
} from '@nestjs/websockets';
import type { Server } from 'socket.io';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../auth/auth.types.js';
import { WsConnectionThrottle } from '../throttle/ws-connection-throttle.js';
import { WsAuthMiddleware } from '../auth/ws-auth.middleware.js';

// Cookies are sent with the handshake; `WsAuthMiddleware` enforces the
// allowed origins (CORS_ORIGINS) and the access token.
@WebSocketGateway({
  cors: { origin: true, credentials: true },
  // reject oversized frames early (default is 1 MB)
  maxHttpBufferSize: 64 * 1024,
})
export class EventsGateway implements OnGatewayInit {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly wsThrottle: WsConnectionThrottle,
    private readonly wsAuth: WsAuthMiddleware,
  ) {}

  afterInit(server: Server) {
    // cheapest check first: per-IP connection rate, then origin + token
    server.use(this.wsThrottle.middleware());
    server.use(this.wsAuth.middleware());
  }

  @SubscribeMessage('ping')
  handlePing(@MessageBody() data: unknown, @CurrentUser() user: AuthUser) {
    return { event: 'pong', data, role: user.role };
  }
}
