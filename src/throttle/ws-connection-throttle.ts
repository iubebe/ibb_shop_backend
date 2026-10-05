import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import type { Socket } from 'socket.io';
import { clientIpFromHandshake } from './client-ip.js';
import type { ThrottleConfig } from './throttle.config.js';
import { THROTTLE_CONFIG } from './throttle.constants.js';

/** Limits new WebSocket handshakes per IP, before any token work happens. */
@Injectable()
export class WsConnectionThrottle {
  constructor(
    @Inject(ThrottlerStorage) private readonly storage: ThrottlerStorage,
    @Inject(THROTTLE_CONFIG) private readonly config: ThrottleConfig,
  ) {}

  middleware() {
    return async (socket: Socket, next: (err?: Error) => void) => {
      if (!this.config.enabled) return next();
      const { address, headers } = socket.handshake;
      const ip = clientIpFromHandshake(
        address,
        headers['x-forwarded-for'],
        this.config.trustProxyHops,
      );
      const key = createHash('sha256').update(`ws-connect-${ip}`).digest('hex');
      const record = await this.storage.increment(
        key,
        this.config.sustained.ttlMs,
        this.config.wsConnectLimit,
        this.config.blockMs,
        'ws-connect',
      );
      if (record.isBlocked || record.totalHits > this.config.wsConnectLimit) {
        return next(new Error('Too many connections'));
      }
      next();
    };
  }
}
