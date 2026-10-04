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
import { WsAuthMiddleware } from '../auth/ws-auth.middleware.js';

// Cookies are sent with the handshake; `WsAuthMiddleware` enforces the
// allowed origins (CORS_ORIGINS) and the access token.
@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class EventsGateway implements OnGatewayInit {
  @WebSocketServer()
  server: Server;

  constructor(private readonly wsAuth: WsAuthMiddleware) {}

  afterInit(server: Server) {
    server.use(this.wsAuth.middleware());
  }

  @SubscribeMessage('ping')
  handlePing(@MessageBody() data: unknown, @CurrentUser() user: AuthUser) {
    return { event: 'pong', data, role: user.role };
  }
}
