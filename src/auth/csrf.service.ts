import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { AUTH_CONFIG } from './auth.constants.js';
import type { AuthConfig } from './auth.config.js';

/**
 * Signed double-submit CSRF token: `<random>.<hmac(random)>`. The server
 * hands it out as a readable cookie; the client echoes it in `X-CSRF-Token`.
 * The signature stops an attacker from planting their own cookie value.
 */
@Injectable()
export class CsrfService {
  constructor(@Inject(AUTH_CONFIG) private readonly config: AuthConfig) {}

  generate(): string {
    const value = randomBytes(32).toString('base64url');
    return `${value}.${this.sign(value)}`;
  }

  /** True when the cookie and header match and the signature is ours. */
  validate(cookie: unknown, header: unknown): boolean {
    if (typeof cookie !== 'string' || typeof header !== 'string') return false;
    if (!safeEqual(cookie, header)) return false;
    const [value, signature, ...rest] = cookie.split('.');
    if (!value || !signature || rest.length) return false;
    return safeEqual(signature, this.sign(value));
  }

  private sign(value: string): string {
    return createHmac('sha256', this.config.csrfSecret)
      .update(value)
      .digest('base64url');
  }
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
