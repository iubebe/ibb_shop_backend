import type { ConfigService } from '@nestjs/config';

export interface ThrottleConfig {
  enabled: boolean;
  /** Proxy hops in front of the app (0 = none); used to find the client IP. */
  trustProxyHops: number;
  /** Per-IP, across all routes, per second. */
  burst: { limit: number; ttlMs: number };
  /** Per-IP, across all routes, per minute (ttl is configurable). */
  sustained: { limit: number; ttlMs: number };
  /** Per-IP, per route, only on `@StrictThrottle()` routes (login...). */
  strict: { limit: number; ttlMs: number; blockMs: number };
  /** Blocking time after burst/sustained is exceeded. */
  blockMs: number;
  /** New WebSocket connections per IP per `sustained.ttlMs`. */
  wsConnectLimit: number;
}

function positive(config: ConfigService, key: string, fallback: number) {
  const value = Number(config.get(key, fallback));
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${key} must be a non-negative number`);
  }
  return value;
}

/**
 * Env (defaults are generous: a whole shop can sit behind one Wi-Fi IP):
 * THROTTLE_ENABLED (true), TRUST_PROXY (0 hops),
 * THROTTLE_BURST_LIMIT (50 / second), THROTTLE_LIMIT (600) per
 * THROTTLE_TTL (60 s), THROTTLE_BLOCK_SECONDS (60),
 * THROTTLE_STRICT_LIMIT (10) per THROTTLE_STRICT_TTL (60 s), blocked for
 * THROTTLE_STRICT_BLOCK_SECONDS (60), WS_CONNECT_LIMIT (30).
 */
export function loadThrottleConfig(config: ConfigService): ThrottleConfig {
  const sec = (key: string, fallback: number) =>
    positive(config, key, fallback) * 1000;
  return {
    enabled: config.get('THROTTLE_ENABLED', 'true') !== 'false',
    trustProxyHops: positive(config, 'TRUST_PROXY', 0),
    burst: { limit: positive(config, 'THROTTLE_BURST_LIMIT', 50), ttlMs: 1000 },
    sustained: {
      limit: positive(config, 'THROTTLE_LIMIT', 600),
      ttlMs: sec('THROTTLE_TTL', 60),
    },
    strict: {
      limit: positive(config, 'THROTTLE_STRICT_LIMIT', 10),
      ttlMs: sec('THROTTLE_STRICT_TTL', 60),
      blockMs: sec('THROTTLE_STRICT_BLOCK_SECONDS', 60),
    },
    blockMs: sec('THROTTLE_BLOCK_SECONDS', 60),
    wsConnectLimit: positive(config, 'WS_CONNECT_LIMIT', 30),
  };
}
