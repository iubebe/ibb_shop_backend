import { type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  getOptionsToken,
  getStorageToken,
  ThrottlerGuard,
  type ThrottlerLimitDetail,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { clientIpFromHandshake } from './client-ip.js';
import { NO_THROTTLE_KEY } from './decorators.js';
import type { ThrottleConfig } from './throttle.config.js';
import { THROTTLE_CONFIG } from './throttle.constants.js';

/** Throttler guard that also understands WebSocket messages. */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  constructor(
    @Inject(getOptionsToken()) options: ThrottlerModuleOptions,
    @Inject(getStorageToken()) storage: ThrottlerStorage,
    reflector: Reflector,
    @Inject(THROTTLE_CONFIG) private readonly config: ThrottleConfig,
  ) {
    super(options, storage, reflector);
  }

  protected override async shouldSkip(ctx: ExecutionContext): Promise<boolean> {
    if (!this.config.enabled) return true;
    return !!this.reflector.getAllAndOverride<boolean>(NO_THROTTLE_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
  }

  protected override getRequestResponse(ctx: ExecutionContext) {
    if (ctx.getType() !== 'ws') return super.getRequestResponse(ctx);
    const { handshake } = ctx.switchToWs().getClient<Socket>();
    return {
      req: {
        ip: clientIpFromHandshake(
          handshake.address,
          handshake.headers['x-forwarded-for'],
          this.config.trustProxyHops,
        ),
        headers: handshake.headers,
      },
      res: {},
    };
  }

  protected override async throwThrottlingException(
    ctx: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    if (ctx.getType() === 'ws') throw new WsException('Too many requests');
    return super.throwThrottlingException(ctx, detail);
  }
}
