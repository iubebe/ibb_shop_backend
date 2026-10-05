import { Injectable } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { PinoLogger } from 'nestjs-pino';
import { REDIS_KEY } from '../constants/redis-key.constants.js';
import { RedisService } from '../redis/redis.service.js';

/**
 * Fixed-window counters shared by every app instance, in one atomic Lua call.
 *
 *   throttle:<key>          hit counter, TTL = window
 *   throttle:block:<key>    exists while the key is blocked
 *
 * While blocked, hits are not counted, so the block does not extend itself.
 * If Redis is unavailable the request is let through (fail open) and an
 * error is logged: an outage must not take the API down with it.
 */
const INCREMENT_LUA = `
local blockTtl = redis.call('PTTL', KEYS[2])
if blockTtl > 0 then
  local hits = tonumber(redis.call('GET', KEYS[1]) or '0')
  return {hits, math.max(redis.call('PTTL', KEYS[1]), 0), 1, blockTtl}
end
local hits = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if hits == 1 or ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
local block = tonumber(ARGV[3])
if block > 0 and hits > tonumber(ARGV[2]) then
  redis.call('SET', KEYS[2], 1, 'PX', block)
  return {hits, ttl, 1, block}
end
return {hits, ttl, 0, 0}
`;

type ThrottlerStorageRecord = Awaited<
  ReturnType<ThrottlerStorage['increment']>
>;

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(
    private readonly redis: RedisService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(RedisThrottlerStorage.name);
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): Promise<ThrottlerStorageRecord> {
    try {
      const [totalHits, ttlMs, blocked, blockMs] =
        (await this.redis.client.eval(
          INCREMENT_LUA,
          2,
          `${REDIS_KEY.THROTTLE}:${key}`,
          `${REDIS_KEY.THROTTLE}:block:${key}`,
          String(ttl),
          String(limit),
          String(blockDuration),
        )) as [number, number, number, number];
      return {
        totalHits,
        timeToExpire: Math.ceil(ttlMs / 1000),
        isBlocked: blocked === 1,
        timeToBlockExpire: Math.ceil(blockMs / 1000),
      };
    } catch (err) {
      this.logger.error({ err }, 'Throttle storage unavailable, failing open');
      return {
        totalHits: 0,
        timeToExpire: 0,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
  }
}
