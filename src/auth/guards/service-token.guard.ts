import { createHash, timingSafeEqual } from 'node:crypto';
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

const MIN_TOKEN_LENGTH = 32;
const digest = (value: string) => createHash('sha256').update(value).digest();

/**
 * Checks `Authorization: Bearer <FORECAST_API_TOKEN>`. With no token (or one
 * shorter than 32 characters) configured the integration is off and every
 * call is refused.
 */
@Injectable()
export class ServiceTokenGuard implements CanActivate {
  private readonly expected: Buffer | null;

  constructor(config: ConfigService) {
    const token = config.get<string>('FORECAST_API_TOKEN')?.trim();
    this.expected = token && token.length >= MIN_TOKEN_LENGTH ? digest(token) : null;
  }

  canActivate(ctx: ExecutionContext): boolean {
    const header = ctx.switchToHttp().getRequest<Request>().headers.authorization;
    const match = header?.match(/^Bearer (.+)$/);
    // Compare fixed-length hashes so the check is constant time.
    if (
      !this.expected ||
      !match ||
      !timingSafeEqual(this.expected, digest(match[1]))
    ) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
