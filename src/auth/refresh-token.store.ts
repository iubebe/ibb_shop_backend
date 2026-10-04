import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service.js';
import { REDIS_KEY } from '../constants/redis-key.constants.js';
import { AUTH_CONFIG } from './auth.constants.js';
import type { AuthConfig } from './auth.config.js';

export type RotateResult =
  | { status: 'ok'; userId: string; sessionId: string; token: string }
  | { status: 'invalid' }
  /** A rotated-out token was presented again: the session was revoked. */
  | { status: 'reused' };

/**
 * Refresh sessions live only in Redis. The token is opaque:
 * `<sessionId>.<secret>`; Redis keeps just the SHA-256 of the secret.
 * Every refresh rotates the secret (atomically, in Lua). Presenting an old
 * secret revokes the whole session.
 *
 *   auth:session:<sid>       hash { userId, hash }   TTL = refresh ttl
 *   auth:user-sessions:<uid> set of sids             (for revoke-all)
 */
const ROTATE_LUA = `
local h = redis.call('HGET', KEYS[1], 'hash')
if not h then return {0} end
if h ~= ARGV[1] then redis.call('DEL', KEYS[1]) return {-1} end
redis.call('HSET', KEYS[1], 'hash', ARGV[2])
redis.call('EXPIRE', KEYS[1], ARGV[3])
return {1, redis.call('HGET', KEYS[1], 'userId')}
`;

@Injectable()
export class RefreshTokenStore {
  constructor(
    private readonly redis: RedisService,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  async create(userId: string): Promise<{ sessionId: string; token: string }> {
    const sessionId = randomUUID();
    const secret = newSecret();
    const key = this.sessionKey(sessionId);
    const userKey = this.userKey(userId);
    const ttl = this.config.refreshTtlSeconds;
    await this.redis.client
      .multi()
      .hset(key, { userId, hash: sha256(secret) })
      .expire(key, ttl)
      .sadd(userKey, sessionId)
      .expire(userKey, ttl)
      .exec();
    return { sessionId, token: `${sessionId}.${secret}` };
  }

  async rotate(token: string | undefined): Promise<RotateResult> {
    const parsed = parse(token);
    if (!parsed) return { status: 'invalid' };
    const next = newSecret();
    const res = (await this.redis.client.eval(
      ROTATE_LUA,
      1,
      this.sessionKey(parsed.sessionId),
      sha256(parsed.secret),
      sha256(next),
      String(this.config.refreshTtlSeconds),
    )) as [number, string?];
    if (res[0] === 1 && res[1]) {
      return {
        status: 'ok',
        userId: res[1],
        sessionId: parsed.sessionId,
        token: `${parsed.sessionId}.${next}`,
      };
    }
    return { status: res[0] === -1 ? 'reused' : 'invalid' };
  }

  /** Logout: drop one session (no-op for unknown/garbled tokens). */
  async revoke(token: string | undefined): Promise<void> {
    const parsed = parse(token);
    if (!parsed) return;
    await this.revokeSession(parsed.sessionId);
  }

  async revokeSession(sessionId: string): Promise<void> {
    const key = this.sessionKey(sessionId);
    const userId = await this.redis.client.hget(key, 'userId');
    const tx = this.redis.client.multi().del(key);
    if (userId) tx.srem(this.userKey(userId), sessionId);
    await tx.exec();
  }

  async revokeAllForUser(userId: string): Promise<void> {
    const userKey = this.userKey(userId);
    const sids = await this.redis.client.smembers(userKey);
    const tx = this.redis.client.multi();
    for (const sid of sids) tx.del(this.sessionKey(sid));
    tx.del(userKey);
    await tx.exec();
  }

  private sessionKey(sessionId: string) {
    return `${REDIS_KEY.AUTH_SESSION}:${sessionId}`;
  }

  private userKey(userId: string) {
    return `${REDIS_KEY.AUTH_USER_SESSIONS}:${userId}`;
  }
}

function newSecret(): string {
  return randomBytes(32).toString('base64url');
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function parse(token: string | undefined) {
  if (!token) return null;
  const [sessionId, secret, ...rest] = token.split('.');
  if (!sessionId || !secret || rest.length) return null;
  return { sessionId, secret };
}
