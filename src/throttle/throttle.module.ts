import { createHash } from 'node:crypto';
import { type ExecutionContext, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppThrottlerGuard } from './app-throttler.guard.js';
import { STRICT_THROTTLE_KEY } from './decorators.js';
import { RedisThrottlerStorage } from './redis-throttler.storage.js';
import { loadThrottleConfig, type ThrottleConfig } from './throttle.config.js';
import {
  THROTTLE_CONFIG,
  THROTTLER_BURST,
  THROTTLER_DEFAULT,
  THROTTLER_STRICT,
} from './throttle.constants.js';
import { WsConnectionThrottle } from './ws-connection-throttle.js';

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

const isStrictRoute = (ctx: ExecutionContext) =>
  !!(
    Reflect.getMetadata(STRICT_THROTTLE_KEY, ctx.getHandler()) ??
    Reflect.getMetadata(STRICT_THROTTLE_KEY, ctx.getClass())
  );

@Module({
  providers: [
    {
      provide: THROTTLE_CONFIG,
      inject: [ConfigService],
      useFactory: loadThrottleConfig,
    },
    RedisThrottlerStorage,
  ],
  exports: [THROTTLE_CONFIG, RedisThrottlerStorage],
})
class ThrottleSupportModule {}

/**
 * Rate limiting backed by Redis, applied globally (REST + WebSocket
 * messages) and first in the guard chain, so floods are rejected before
 * CSRF/JWT work. Throttlers, all per client IP:
 *  - burst:   requests per second, across all routes
 *  - default: requests per minute, across all routes
 *  - strict:  per route, only where `@StrictThrottle()` is set
 * Opt out with `@NoThrottle()`. Import this module BEFORE `AuthModule`.
 */
@Module({
  imports: [
    ThrottleSupportModule,
    ThrottlerModule.forRootAsync({
      imports: [ThrottleSupportModule],
      inject: [THROTTLE_CONFIG, RedisThrottlerStorage],
      useFactory: (config: ThrottleConfig, storage: RedisThrottlerStorage) => ({
        storage,
        throttlers: [
          {
            name: THROTTLER_BURST,
            limit: config.burst.limit,
            ttl: config.burst.ttlMs,
            blockDuration: config.blockMs,
          },
          {
            name: THROTTLER_DEFAULT,
            limit: config.sustained.limit,
            ttl: config.sustained.ttlMs,
            blockDuration: config.blockMs,
          },
          {
            name: THROTTLER_STRICT,
            limit: config.strict.limit,
            ttl: config.strict.ttlMs,
            blockDuration: config.strict.blockMs,
            skipIf: (ctx: ExecutionContext) => !isStrictRoute(ctx),
          },
        ],
        // burst/default count per IP over all routes; strict counts per route
        generateKey: (ctx, tracker, name) =>
          name === THROTTLER_STRICT
            ? sha256(
                `${ctx.getClass().name}-${ctx.getHandler().name}-${name}-${tracker}`,
              )
            : sha256(`${name}-${tracker}`),
      }),
    }),
  ],
  providers: [
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    WsConnectionThrottle,
  ],
  exports: [WsConnectionThrottle],
})
export class ThrottleModule {}
