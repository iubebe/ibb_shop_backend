import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WsException } from '@nestjs/websockets';
import { AppThrottlerGuard } from '../app-throttler.guard.js';
import { NO_THROTTLE_KEY } from '../decorators.js';
import type { ThrottleConfig } from '../throttle.config.js';

const config = {
  enabled: true,
  trustProxyHops: 1,
} as ThrottleConfig;

function guardWith(meta: Record<string, unknown>, cfg = config) {
  const reflector = {
    getAllAndOverride: (key: string) => meta[key],
  } as unknown as Reflector;
  return new AppThrottlerGuard({ throttlers: [] }, {} as never, reflector, cfg);
}

// the protected hooks are what we customised
type Hooks = {
  shouldSkip(ctx: ExecutionContext): Promise<boolean>;
  getRequestResponse(ctx: ExecutionContext): {
    req: { ip: string };
    res: object;
  };
  throwThrottlingException(ctx: ExecutionContext, d: object): Promise<void>;
};

const wsCtx = {
  getType: () => 'ws',
  getHandler: () => 'h',
  getClass: () => 'c',
  switchToWs: () => ({
    getClient: () => ({
      handshake: {
        address: '10.0.0.1',
        headers: { 'x-forwarded-for': '6.6.6.6, 2.2.2.2' },
      },
    }),
  }),
} as unknown as ExecutionContext;

describe('AppThrottlerGuard', () => {
  it('skips when disabled or marked @NoThrottle()', async () => {
    const ctx = wsCtx;
    expect(
      await (
        guardWith({}, { ...config, enabled: false }) as unknown as Hooks
      ).shouldSkip(ctx),
    ).toBe(true);
    expect(
      await (
        guardWith({ [NO_THROTTLE_KEY]: true }) as unknown as Hooks
      ).shouldSkip(ctx),
    ).toBe(true);
    expect(await (guardWith({}) as unknown as Hooks).shouldSkip(ctx)).toBe(
      false,
    );
  });

  it('tracks WebSocket messages by the real client IP', () => {
    const { req } = (guardWith({}) as unknown as Hooks).getRequestResponse(
      wsCtx,
    );
    expect(req.ip).toBe('2.2.2.2');
  });

  it('throws a WsException for WebSocket limits', async () => {
    await expect(
      (guardWith({}) as unknown as Hooks).throwThrottlingException(wsCtx, {}),
    ).rejects.toThrow(WsException);
  });
});
